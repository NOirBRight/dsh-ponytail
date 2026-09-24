/** DSH Host plugin for Ponytail's modes, hooks, skills, and Loader configuration. */

import { Context, Service } from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision, SessionStartSource } from '@deepseek-ai/dsh-agent'
import type { Session, UserMessage } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { CommandResult } from '@deepseek-ai/dsh-commands'
import { PONYTAIL_MODES, isDeactivationCommand, textOnlyContent, type PonytailMode } from './mode.ts'
import {
  compileSubagentMatcher,
  Config,
  resolveSettings,
  type PonytailConfig,
  type PonytailSettings,
} from './config.ts'
import { PONYTAIL_CONFIG_ENTRY_ID } from './config-entry.ts'
import { buildPolicy } from './policy.ts'
import type { PonytailModeEvent, PonytailUnitState } from './projection.ts'
import { discoverBundledSkills } from './skills.ts'
import { allowDshRuntime } from './compatibility.ts'

/** Plugin identifier used by Cordis and the DSH bundle loader. */
export const name = 'dsh-ponytail'

/** Required DSH Host capabilities. */
export const inject = ['agents', 'commands', 'settings', 'skills', 'systemPrompt']

/** Hide the base skill even when another provider also installed Ponytail globally. */
function withoutBaseSkillCatalog(messages: UserMessage[]): UserMessage[] {
  return messages.map(message => (message.source as { kind: string }).kind !== 'skill-catalog' ? message : {
    ...message,
    content: message.content.map(block => block.type !== 'text' ? block : {
      ...block,
      text: block.text.split('\n').filter(line => !line.startsWith('- `ponytail`:')).join('\n'),
    }),
  })
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    ponytail: PonytailController
  }
}

/** One DSH session's Ponytail controller. */
export class PonytailController extends Service {
  static inject = inject
  static Config = Config

  private readonly config!: PonytailConfig
  private readonly modes = new WeakMap<Session, PonytailUnitState>()

  /**
   * @param ctx - Host context owning the plugin.
   * @param config - Loader preferences owned by this entry.
   */
  constructor(ctx: Context, config: PonytailConfig) {
    super(ctx, 'ponytail')
    if (!allowDshRuntime(ctx.logger, 'dsh-ponytail', ['@deepseek-ai/dsh-agent'])) return
    this.config = config
    // Resolve once at construction so invalid environment values fail before
    // this service is published; every later read follows volatile updates.
    this.currentSettings()
    ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber), 'dsh-ponytail: settings presentation')

    ctx.systemPrompt.section({
      name: 'ponytail:policy',
      order: ctx.systemPrompt.getSectionOrder('PLAN_POLICY') + 1,
      text: ({ agent }) => agent === undefined ? '' : this.policyFor(agent),
    })

    for (const skill of discoverBundledSkills()) ctx.skills.register(skill)

    ctx.on('agent/created', ({ agent, source }) => {
      this.initializeSession(agent, source)
      return undefined
    })
    ctx.on('agent/inbox/inserted', ({ agent, message }) => {
      this.applyNaturalDeactivation(agent, [message])
    })
    ctx.on('agent/pre-step', async ({ agent, signal }, next): Promise<PreStepDecision> => {
      const decision = await next()
      if (decision.kind !== 'enter' || signal.aborted) return decision
      this.applyPending(agent)
      return { ...decision, messages: withoutBaseSkillCatalog(decision.messages) }
    })

    ctx.commands.register({
      name: 'ponytail',
      description: 'Show or change Ponytail mode',
      input: { hint: '[status|lite|full|ultra|off|default <mode>]' },
      handler: invocation => this.handleCommand(invocation.agent, invocation.rawInput),
    })
  }

  /** Read live Loader preferences with environment variables at highest priority. */
  currentSettings(): PonytailSettings {
    return resolveSettings({
      env: process.env,
      config: {
        defaultMode: this.config.defaultMode.get(),
        hideStatus: this.config.hideStatus.get(),
        quietStartup: this.config.quietStartup.get(),
        subagentMatcher: this.config.subagentMatcher.get(),
      },
    })
  }

  /** Read live mode state; a fresh runtime starts from the configured default. */
  stateOf(session: Session): PonytailUnitState {
    return this.modes.get(session) ?? {
      mode: this.currentSettings().defaultMode,
      pending: null,
      source: 'default',
      inheritedFrom: null,
    }
  }

  /** Return the mode policy for the next model request. */
  policyFor(agent: Agent): string {
    const state = this.stateOf(agent.session)
    if (!this.isEligibleAgent(agent)) return ''
    return buildPolicy(state.pending ?? state.mode)
  }

  /** Apply the child matcher and preserve the upstream missing-preset fail-open rule. */
  isEligibleAgent(agent: Agent): boolean {
    const header = agent.session.header
    if (header.parentSession === undefined) return true
    const matcher = this.currentSettings().subagentMatcher
    if (header.agentPreset === undefined || matcher === '') return true
    return (compileSubagentMatcher(matcher)?.test(header.agentPreset) ?? true)
  }

  /** Initialize live mode state, inheriting an active parent when available. */
  initializeSession(agent: Agent, source: SessionStartSource): void {
    const session = agent.session
    if (source !== 'startup' && this.modes.has(session)) return

    const parentId = session.header.parentSession
    const parent = parentId === undefined ? undefined : this.ctx.agents.get(parentId)
    const parentState = parent === undefined ? undefined : this.stateOf(parent.session)
    const inherited = parentId === undefined ? undefined : parentState ?? this.stateOf(session)
    const eligible = this.isEligibleAgent(agent)
    const mode = !eligible ? 'off' : inherited?.mode ?? this.currentSettings().defaultMode
    const event: PonytailModeEvent = {
      mode,
      pending: null,
      source: inherited === undefined ? 'default' : 'inherit',
      inheritedFrom: parentId === undefined ? null : parentId,
    }
    this.modes.set(session, event)
  }

  /** Apply a pending command selection at the next accepted model step. */
  applyPending(agent: Agent): void {
    const state = this.stateOf(agent.session)
    if (state.pending === null) return
    this.setLiveMode(agent.session, state.pending, null, 'command')
  }

  /** Turn an exact natural-language deactivation into the current request's state. */
  applyNaturalDeactivation(agent: Agent, messages: readonly UserMessage[]): void {
    const message = messages.at(-1)
    if (message === undefined) return
    const text = textOnlyContent(message.content)
    if (text === undefined || !isDeactivationCommand(text)) return
    const state = this.stateOf(agent.session)
    if (state.mode === 'off' && state.pending === null) return
    this.setLiveMode(agent.session, 'off', null, 'natural-language')
  }

  /** Store a complete live mode value without adding a custom session event. */
  setLiveMode(session: Session, mode: PonytailMode, pending: PonytailMode | null, source: PonytailModeEvent['source']): void {
    const current = this.stateOf(session)
    this.modes.set(session, {
      mode,
      pending,
      source,
      inheritedFrom: current.inheritedFrom,
    })
  }

  /** Set a session mode immediately or queue it for the next model step. */
  setMode(agent: Agent, mode: PonytailMode): 'committed' | 'pending' | 'noop' {
    const current = this.stateOf(agent.session)
    const target = current.pending ?? current.mode
    if (target === mode) return 'noop'
    if (agent.status === 'running') {
      this.setLiveMode(agent.session, current.mode, mode, 'pending')
      return 'pending'
    }
    this.setLiveMode(agent.session, mode, null, 'command')
    return 'committed'
  }

  /** Dispatch the complete `/ponytail` grammar. */
  async handleCommand(agent: Agent, rawInput: string): Promise<CommandResult> {
    const input = rawInput.trim()
    const words = input.toLowerCase().split(/\s+/).filter(Boolean)
    if (words.length === 0 || words[0] === 'status') {
      if (words.length > 1) return { kind: 'error', text: 'Usage: /ponytail [status|lite|full|ultra|off|default <mode>]' }
      return { kind: 'success', text: this.statusText(agent) }
    }
    if (words[0] === 'default') {
      if (words.length !== 2) return { kind: 'error', text: 'Usage: /ponytail default <off|lite|full|ultra>' }
      const mode = this.parseCommandMode(words[1])
      if (mode === undefined) return { kind: 'error', text: 'Mode must be one of off|lite|full|ultra.' }
      await this.ctx.settings.mutate(PONYTAIL_CONFIG_ENTRY_ID, [
        { op: 'set', path: ['defaultMode'], value: mode },
      ])
      return { kind: 'success', text: `Ponytail default mode set to ${mode}.` }
    }
    if (words.length !== 1) return { kind: 'error', text: 'Usage: /ponytail [status|lite|full|ultra|off|default <mode>]' }
    const mode = this.parseCommandMode(words[0])
    if (mode === undefined) return { kind: 'error', text: 'Mode must be one of off|lite|full|ultra.' }
    const result = this.setMode(agent, mode)
    if (result === 'noop') return { kind: 'success', text: `Ponytail mode is already ${mode}.` }
    if (result === 'pending') return { kind: 'success', text: `Ponytail mode will switch to ${mode} at the next step.` }
    return { kind: 'success', text: `Ponytail mode: ${mode}.` }
  }

  /** Format the status command without exposing settings internals. */
  statusText(agent: Agent): string {
    const state = this.stateOf(agent.session)
    const pending = state.pending === null ? '' : ` (pending: ${state.pending})`
    return `Ponytail mode: ${state.mode}${pending}. Default: ${this.currentSettings().defaultMode}.`
  }

  /** Normalize one command token without accepting upstream-only `review`. */
  parseCommandMode(value: string | undefined): PonytailMode | undefined {
    if (value === undefined) return undefined
    const normalized = value.trim().toLowerCase()
    return (PONYTAIL_MODES as readonly string[]).includes(normalized) ? normalized as PonytailMode : undefined
  }
}

export { buildPolicy, discoverBundledSkills }
export type { PonytailMode } from './mode.ts'
export type { PonytailModeEvent, PonytailProjection, PonytailUnitState } from './projection.ts'
export { Config }
export type { PonytailConfig, PonytailSettings } from './config.ts'
export default PonytailController
