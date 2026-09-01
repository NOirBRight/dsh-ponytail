import { strict as assert } from 'node:assert'
import { Context } from '@deepseek-ai/cordis'
import { Loader } from '@deepseek-ai/cordis-plugin-loader'
import { AgentRegistry } from '@deepseek-ai/dsh-agent'
import { CommandRuntime } from '@deepseek-ai/dsh-commands'
import { SessionStore } from '@deepseek-ai/dsh-session'
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import { SkillRegistry } from '@deepseek-ai/dsh-skill'
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

class MemorySettings extends SettingsProvider {
  raw = {}

  get writable() {
    return true
  }

  async load() {
    return structuredClone(this.raw)
  }

  async persist(ns, section) {
    this.raw[ns] = structuredClone(section)
  }
}

for (const [name, value] of Object.entries({
  PONYTAIL_DEFAULT_MODE: 'full',
  PONYTAIL_HIDE_STATUS: 'false',
  PONYTAIL_QUIET_STARTUP: 'false',
  PONYTAIL_SUBAGENT_MATCHER: '',
})) process.env[name] = value

const ctx = new Context()
try {
  for (const [plugin, config] of [
    [SessionStore],
    [SessionProjectionRegistry],
    [AgentRegistry],
    [CommandRuntime],
    [SkillRegistry],
    [SystemPrompt, {}],
    [MemorySettings],
    [Loader],
  ]) await ctx.plugin(plugin, config)

  const pluginUrl = pathToFileURL(resolve('lib/index.js')).href
  const entryId = await ctx.loader.create({ id: 'ponytail', name: pluginUrl })
  assert.equal(entryId, 'ponytail')
  assert.equal(ctx.loader.resolve('ponytail').options.name, pluginUrl)
  assert.equal(ctx.ponytail.name, 'ponytail')

  const session = ctx.sessions.create('loader-smoke-session')
  const agent = { id: session.id, session, status: 'idle', ctx, options: {}, inbox: {} }
  ctx.agents.register(agent)
  ctx.emit('agent/session-start', { agent, source: 'startup' })
  assert.deepEqual(ctx.ponytail.stateOf(session), {
    mode: 'full',
    pending: null,
    source: 'default',
    inheritedFrom: null,
  })
  assert.equal((await ctx.skills.list()).length, 6)
  assert.match(ctx.ponytail.policyFor(agent), /^PONYTAIL MODE ACTIVE — level: full/)
  console.log('loader smoke passed: alpha.3 Loader mounted the built Host plugin')
} finally {
  await ctx.fiber.dispose()
}
