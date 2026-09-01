import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { AgentRegistry, type Agent } from '@deepseek-ai/dsh-agent'
import { CommandRuntime } from '@deepseek-ai/dsh-commands'
import { SessionStore } from '@deepseek-ai/dsh-session'
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { SkillRegistry } from '@deepseek-ai/dsh-skill'
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt'
import PonytailController from '../src/index.ts'

class MemorySettings extends SettingsProvider {
  private readonly raw: Record<string, unknown> = {}

  override get writable(): boolean {
    return true
  }

  protected override load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.raw))
  }

  protected override persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.raw[ns] = structuredClone(section)
    return Promise.resolve()
  }
}

const environmentNames = [
  'PONYTAIL_DEFAULT_MODE',
  'PONYTAIL_HIDE_STATUS',
  'PONYTAIL_QUIET_STARTUP',
  'PONYTAIL_SUBAGENT_MATCHER',
] as const
let previousEnvironment: Partial<Record<typeof environmentNames[number], string | undefined>>
const activeContexts: Context[] = []

beforeEach(() => {
  previousEnvironment = Object.fromEntries(environmentNames.map(name => [name, process.env[name]]))
  process.env.PONYTAIL_DEFAULT_MODE = 'full'
  process.env.PONYTAIL_HIDE_STATUS = 'false'
  process.env.PONYTAIL_QUIET_STARTUP = 'false'
  process.env.PONYTAIL_SUBAGENT_MATCHER = ''
})

afterEach(async () => {
  while (activeContexts.length > 0) await activeContexts.pop()!.fiber.dispose()
  for (const name of environmentNames) {
    const value = previousEnvironment[name]
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

async function boot() {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(SkillRegistry)
  await ctx.plugin(SystemPrompt, {})
  await ctx.plugin(MemorySettings)
  await ctx.plugin(PonytailController)
  activeContexts.push(ctx)
  return ctx
}

function registerAgent(ctx: Context, id: string, meta?: { parentSession?: Agent['id']; agentPreset?: string }): Agent {
  const session = ctx.sessions.create(id as Agent['id'], { meta: { cwd: process.cwd(), ...meta } })
  const agent = { id: session.id, session, status: 'idle', ctx, options: {}, inbox: {} } as unknown as Agent
  ctx.agents.register(agent)
  return agent
}

describe('Ponytail Host integration', () => {
  it('loads through alpha.3 services, records mode events, and handles pending commands', async () => {
    const ctx = await boot()
    const agent = registerAgent(ctx, 'session-parent')
    ctx.emit('agent/session-start', { agent, source: 'startup' })

    expect(ctx.ponytail.stateOf(agent.session)).toMatchObject({ mode: 'full', pending: null, source: 'default' })
    await expect(ctx.skills.list()).resolves.toHaveLength(6)
    expect(ctx.ponytail.policyFor(agent)).toContain('PONYTAIL MODE ACTIVE — level: full')

    ;(agent as unknown as { status: 'idle' | 'running' }).status = 'running'
    expect(ctx.ponytail.setMode(agent, 'ultra')).toBe('pending')
    expect(ctx.sessionProjections.stateOf(agent.session, 'ponytail')).toMatchObject({ mode: 'full', pending: 'ultra' })
    ctx.ponytail.applyPending(agent)
    expect(ctx.ponytail.stateOf(agent.session)).toMatchObject({ mode: 'ultra', pending: null, source: 'command' })

    ;(agent as unknown as { status: 'idle' | 'running' }).status = 'idle'
    const result = await ctx.ponytail.handleCommand(agent, 'off')
    expect(result).toEqual({ kind: 'success', text: 'Ponytail mode: off.' })
    expect(ctx.ponytail.stateOf(agent.session).mode).toBe('off')
    expect(ctx.ponytail.policyFor(agent)).toBe('')
  })

  it('deactivates only an exact text-only request and inherits a live parent mode', async () => {
    const ctx = await boot()
    const parent = registerAgent(ctx, 'session-parent')
    ctx.emit('agent/session-start', { agent: parent, source: 'startup' })
    ctx.ponytail.setMode(parent, 'lite')

    const child = registerAgent(ctx, 'session-child', { parentSession: parent.id, agentPreset: 'Worker-General' })
    ctx.emit('agent/session-start', { agent: child, source: 'startup' })
    expect(ctx.ponytail.stateOf(child.session)).toMatchObject({ mode: 'lite', source: 'inherit', inheritedFrom: parent.id })

    ctx.ponytail.applyNaturalDeactivation(child, [{ content: [{ type: 'text', text: 'add a normal mode toggle' }] }] as never)
    expect(ctx.ponytail.stateOf(child.session).mode).toBe('lite')
    ctx.ponytail.applyNaturalDeactivation(child, [{ content: [{ type: 'text', text: ' NORMAL MODE!!! ' }] }] as never)
    expect(ctx.ponytail.stateOf(child.session)).toMatchObject({ mode: 'off', source: 'natural-language' })
  })

  it('scopes child injection by agentPreset while allowing missing preset metadata', async () => {
    process.env.PONYTAIL_SUBAGENT_MATCHER = 'worker'
    const ctx = await boot()
    const parent = registerAgent(ctx, 'session-parent')
    ctx.emit('agent/session-start', { agent: parent, source: 'startup' })
    ctx.ponytail.setMode(parent, 'ultra')

    const excluded = registerAgent(ctx, 'session-excluded', { parentSession: parent.id, agentPreset: 'explore' })
    ctx.emit('agent/session-start', { agent: excluded, source: 'startup' })
    expect(ctx.ponytail.stateOf(excluded.session).mode).toBe('off')
    expect(ctx.ponytail.policyFor(excluded)).toBe('')

    const unknown = registerAgent(ctx, 'session-unknown', { parentSession: parent.id })
    ctx.emit('agent/session-start', { agent: unknown, source: 'startup' })
    expect(ctx.ponytail.stateOf(unknown.session).mode).toBe('ultra')
    expect(ctx.ponytail.policyFor(unknown)).toContain('PONYTAIL MODE ACTIVE')
  })

  it('persists the default command through the DSH settings provider', async () => {
    const ctx = await boot()
    const agent = registerAgent(ctx, 'session-settings')
    ctx.emit('agent/session-start', { agent, source: 'startup' })
    await expect(ctx.ponytail.handleCommand(agent, 'default lite')).resolves.toEqual({
      kind: 'success',
      text: 'Ponytail default mode set to lite.',
    })
    expect(ctx.settings.get('ponytail')).toMatchObject({ defaultMode: 'lite' })
    await expect(ctx.settings.update('ponytail', { subagentMatcher: '[' })).rejects.toThrow(/valid regular expression/)
    expect(ctx.settings.get('ponytail')).toMatchObject({ subagentMatcher: '' })
  })

  it('does not reset a mode that exists in a resumed seed prefix', async () => {
    const ctx = await boot()
    const session = ctx.sessions.create('session-resumed' as Agent['id'], {
      seed: [{
        type: 'ponytail/mode',
        seq: 0,
        time: 1,
        data: { mode: 'ultra', pending: null, source: 'command', inheritedFrom: null },
      } as never],
      meta: { cwd: process.cwd(), seedLength: 1 },
    })
    const agent = { id: session.id, session, status: 'idle', ctx, options: {}, inbox: {} } as unknown as Agent
    ctx.agents.register(agent)
    ctx.emit('agent/session-start', { agent, source: 'resume' })

    expect(ctx.ponytail.stateOf(session)).toMatchObject({ mode: 'ultra', pending: null })
    expect(session.events.filter(event => event.type === 'ponytail/mode')).toHaveLength(1)
  })

})
