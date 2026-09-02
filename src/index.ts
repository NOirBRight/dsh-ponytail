/** DSH Host plugin for Ponytail's modes, hooks, skills, and settings. */

import { Context, Service } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { Session, UserMessage } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-session-projection'
import type { CommandResult } from '@deepseek-ai/dsh-commands'
import { PONYTAIL_MODES, isDeactivationCommand, textOnlyContent, type PonytailMode } from './mode.ts'
import {
  compileSubagentMatcher,
  loadSettingsSync,
  readUpstreamConfigSync,
  resolveSettings,
  upstreamConfigPath,
  validateSettings,
  type PonytailSettings,
} from './config.ts'
import { buildPolicy } from './policy.ts'
import { createPonytailProjectionDefinition, type PonytailModeEvent, type PonytailUnitState } from './projection.ts'
import { discoverBundledSkills } from './skills.ts'
import { registerHostSessionEvent } from './session-catalog.ts'

/** Plugin identifier used by Cordis and the DSH bundle loader. */
export const name = 'dsh-ponytail'

/** Required Host capabilities. */
export const inject = ['agents', 'commands', 'sessionProjections', 'settings', 'skills', 'systemPrompt']

/** Schema for the optional empty bundle config. Settings are user-editable through `ctx.settings`. */
const pluginConfigSchema = Schema.object({})

/** The settings namespace exposed to DSH Settings and the browser mirror. */
export const PONYTAIL_SETTINGS_NAMESPACE = 'ponytail'

/** Event name persisted by this downstream plugin. */
const PONYTAIL_MODE_EVENT = 'ponytail/mode'

/** Schema used by the DSH settings provider. */
export const ponytailSettingsSchema = Schema.object({
  defaultMode: Schema.union(PONYTAIL_MODES.map(mode => Schema.const(mode))).default('full').description('Default Ponytail mode for new sessions.'),
  hideStatus: Schema.boolean().default(false).description('Legacy compatibility value; Ponytail no longer injects a composer control.'),
  quietStartup: Schema.boolean().default(true).description('Hide the browser session-start notice by default.'),
  subagentMatcher: Schema.string().default('').description('Case-insensitive unanchored regular expression over agentPreset.'),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    ponytail: PonytailController
  }
}

/** One DSH session's Ponytail controller. */
export class PonytailController extends Service {
  static inject = inject
  static Config = pluginConfigSchema

  private readonly settingsScope
  private readonly baseSettings: PonytailSettings

  /**
   * @param ctx - Host context owning the plugin.
   * @param _config - Bundle config; currently intentionally empty.
   */
  constructor(ctx: Context, _config: Record<string, never> = {}) {
    super(ctx, 'ponytail')
    // DSH Alpha.4 intentionally keeps the core persistence catalog
    // static. Register this required plugin event in the Host's shared catalog
    // while the plugin is loaded so session recovery does not reject its logs.
    ctx.effect(
      () => registerHostSessionEvent(ctx, PONYTAIL_MODE_EVENT),
      'dsh-ponytail: persistence event vocabulary',
    )
    const startup = loadSettingsSync()
    const upstream = readUpstreamConfigSync(upstreamConfigPath())
    this.baseSettings = resolveSettings({ env: {}, upstream })
    this.settingsScope = ctx.settings.register(PONYTAIL_SETTINGS_NAMESPACE, ponytailSettingsSchema, {
      base: this.baseSettings,
      applies: 'live',
      validate: validateSettings,
    })
    // Read the resolved setting once at construction so a malformed environment
    // variable or config fails before this service is published.
    validateSettings(startup)

    ctx.sessionProjections.register(createPonytailProjectionDefinition(this.currentSettings().defaultMode))
    ctx.systemPrompt.section({
      name: 'ponytail:policy',
      order: ctx.systemPrompt.getSectionOrder('PLAN_POLICY') + 1,
      text: ({ agent }) => agent === undefined ? '' : this.policyFor(agent),
    })

    for (const skill of discoverBundledSkills()) ctx.skills.register(skill)

    ctx.on('agent/session-start', ({ agent, source }) => {
      this.initializeSession(agent, source)
    })
    ctx.on('agent/pre-step', async ({ agent, messages, signal }, next): Promise<PreStepDecision> => {
      this.applyNaturalDeactivation(agent, messages)
      const decision = await next()
      if (decision.kind === 'enter' && !signal.aborted) this.applyPending(agent)
      return decision
    })

    ctx.commands.register({
      name: 'ponytail',
      description: 'Show or change Ponytail mode',
      input: { hint: '[status|lite|full|ultra|off|default <mode>]' },
      handler: invocation => this.handleCommand(invocation.agent, invocation.rawInput),
    })
  }

  /** Read settings with environment variables taking the documented highest priority. */
  currentSettings(): PonytailSettings {
    return resolveSettings({ env: process.env, dsh: this.settingsScope.get() as Partial<PonytailSettings> })
  }

  /** Read the folded state; registration is required by this plugin's inject list. */
  stateOf(session: Session): PonytailUnitState {
    const state = this.ctx.sessionProjections.stateOf(session, 'ponytail')
    if (state === undefined) throw new Error('dsh-ponytail requires the ponytail projection')
    return state
  }

  /** Return the mode policy for a model request. */
  policyFor(agent: Agent): string {
    const state = this.stateOf(agent.session)
    if (!this.isEligibleAgent(agent)) return ''
    return buildPolicy(state.mode)
  }

  /** Apply the child matcher and preserve the upstream missing-preset fail-open rule. */
  isEligibleAgent(agent: Agent): boolean {
    const header = agent.session.header
    if (header.parentSession === undefined) return true
    const matcher = this.currentSettings().subagentMatcher
    if (header.agentPreset === undefined || matcher === '') return true
    return (compileSubagentMatcher(matcher)?.test(header.agentPreset) ?? true)
  }

  /** Initialize a fresh session or append an explicit child inheritance event. */
  initializeSession(agent: Agent, source: 'startup' | 'resume' | 'clear' | 'compact'): void {
    const session = agent.session
    // Resume, clear, and compact reuse an existing session log. A mode event
    // in the seeded prefix is already authoritative; only a fresh startup
    // adds the child-inheritance/default event over that prefix.
    const hasMode = session.snapshotEvents().some(event => event.type === PONYTAIL_MODE_EVENT)
    if (source !== 'startup' && hasMode) return

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
    session.append(PONYTAIL_MODE_EVENT, event)
  }

  /** Apply a pending command selection at the next accepted model step. */
  applyPending(agent: Agent): void {
    const state = this.stateOf(agent.session)
    if (state.pending === null) return
    this.appendMode(agent.session, state.pending, null, 'command')
  }

  /** Turn an exact natural-language deactivation into the current request's state. */
  applyNaturalDeactivation(agent: Agent, messages: readonly UserMessage[]): void {
    const message = messages.at(-1)
    if (message === undefined) return
    const text = textOnlyContent(message.content)
    if (text === undefined || !isDeactivationCommand(text)) return
    const state = this.stateOf(agent.session)
    if (state.mode === 'off' && state.pending === null) return
    this.appendMode(agent.session, 'off', null, 'natural-language')
  }

  /** Append a complete post-change mode value. */
  appendMode(session: Session, mode: PonytailMode, pending: PonytailMode | null, source: PonytailModeEvent['source']): void {
    const current = this.stateOf(session)
    session.append(PONYTAIL_MODE_EVENT, {
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
      this.appendMode(agent.session, current.mode, mode, 'pending')
      return 'pending'
    }
    this.appendMode(agent.session, mode, null, 'command')
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
      await this.settingsScope.update({ defaultMode: mode })
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
export type { PonytailSettings } from './config.ts'
export default PonytailController
