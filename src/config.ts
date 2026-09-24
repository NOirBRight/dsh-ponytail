/** Loader Config schema and environment/upstream preference resolution. */

import Schema from '@deepseek-ai/schemastery'
import type { Volatile } from '@deepseek-ai/cordis'
import { PONYTAIL_MODES, requireMode, type PonytailMode } from './mode.ts'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

/** User settings owned by the Ponytail DSH plugin. */
export interface PonytailSettings {
  /** Mode used when a new session has no inherited mode. */
  defaultMode: PonytailMode
  /** Legacy compatibility value retained for existing Ponytail configuration. */
  hideStatus: boolean
  /** Suppress only the browser session-start notice; enabled by default. */
  quietStartup: boolean
  /** Unanchored, case-insensitive matcher over `agentPreset`. Empty means all. */
  subagentMatcher: string
}

/** Live Loader preferences; matcher is validated at load, not editable through forms. */
export type PonytailConfig = {
  [K in Exclude<keyof PonytailSettings, 'subagentMatcher'>]: Volatile<PonytailSettings[K]>
} & { subagentMatcher: string }

/** A partial settings source, before schema defaults are applied. */
export type PonytailSettingsLayer = Partial<PonytailSettings>

/** Process defaults shared by every source resolver. */
export const DEFAULT_SETTINGS: PonytailSettings = {
  defaultMode: 'full',
  hideStatus: false,
  quietStartup: true,
  subagentMatcher: '',
}

/** Environment lookup kept injectable for deterministic tests. */
export type Environment = Record<string, string | undefined>

/** Validate the matcher and return the same setting values detached. */
export function validateSettings(value: PonytailSettings): PonytailSettings {
  const defaultMode = requireMode(value.defaultMode, 'defaultMode')
  if (typeof value.hideStatus !== 'boolean') throw new Error('hideStatus must be boolean')
  if (typeof value.quietStartup !== 'boolean') throw new Error('quietStartup must be boolean')
  if (typeof value.subagentMatcher !== 'string') throw new Error('subagentMatcher must be string')
  compileSubagentMatcher(value.subagentMatcher)
  return { defaultMode, hideStatus: value.hideStatus, quietStartup: value.quietStartup, subagentMatcher: value.subagentMatcher }
}

/** Compile a matcher with the upstream case-insensitive, unanchored semantics. */
export function compileSubagentMatcher(value: string): RegExp | undefined {
  if (value === '') return undefined
  try {
    return new RegExp(value, 'i')
  } catch (error) {
    throw new Error(`subagentMatcher is not a valid regular expression: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/** Parse the upstream-style truthy environment flag. */
export function parseBooleanEnvironment(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined
  const normalized = value.trim().toLowerCase()
  return normalized !== '' && normalized !== '0' && normalized !== 'false' && normalized !== 'no'
}

/** Read the optional upstream file to seed Loader Config defaults. */
export function readUpstreamConfigSync(path: string): PonytailSettingsLayer {
  try {
    const text = readFileSync(path, 'utf8')
    const parsed: unknown = JSON.parse(text.replace(/^\uFEFF/, ''))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const record = parsed as Record<string, unknown>
    const layer: PonytailSettingsLayer = {}
    if (record.defaultMode !== undefined) layer.defaultMode = requireMode(record.defaultMode, 'defaultMode')
    if (record.hideStatus !== undefined) layer.hideStatus = record.hideStatus === true
    if (record.quietStartup !== undefined) layer.quietStartup = record.quietStartup === true
    if (record.subagentMatcher !== undefined) {
      if (typeof record.subagentMatcher !== 'string') throw new Error('subagentMatcher must be string')
      layer.subagentMatcher = record.subagentMatcher
      compileSubagentMatcher(record.subagentMatcher)
    }
    return layer
  } catch (error) {
    if (error instanceof SyntaxError || (error as NodeJS.ErrnoException | null)?.code === 'ENOENT') return {}
    throw error
  }
}

/** Return the path used by Ponytail's optional upstream config file. */
export function upstreamConfigPath(env: Environment = process.env, home = homedir()): string {
  const root = env.XDG_CONFIG_HOME ?? join(home, '.config')
  return join(root, 'ponytail', 'config.json')
}

/** Resolve environment → Loader Config → upstream file → defaults. */
export function resolveSettings(
  sources: {
    env?: Environment
    config?: PonytailSettingsLayer
    upstream?: PonytailSettingsLayer
  } = {},
): PonytailSettings {
  const env = sources.env ?? process.env
  const upstream = sources.upstream ?? {}
  const config = sources.config ?? {}
  const envLayer: PonytailSettingsLayer = {}
  if (env.PONYTAIL_DEFAULT_MODE !== undefined) envLayer.defaultMode = requireMode(env.PONYTAIL_DEFAULT_MODE, 'PONYTAIL_DEFAULT_MODE')
  const hideStatus = parseBooleanEnvironment(env.PONYTAIL_HIDE_STATUS)
  if (hideStatus !== undefined) envLayer.hideStatus = hideStatus
  const quietStartup = parseBooleanEnvironment(env.PONYTAIL_QUIET_STARTUP)
  if (quietStartup !== undefined) envLayer.quietStartup = quietStartup
  if (env.PONYTAIL_SUBAGENT_MATCHER !== undefined) envLayer.subagentMatcher = env.PONYTAIL_SUBAGENT_MATCHER
  const merged: PonytailSettings = {
    defaultMode: envLayer.defaultMode ?? config.defaultMode ?? upstream.defaultMode ?? DEFAULT_SETTINGS.defaultMode,
    hideStatus: envLayer.hideStatus ?? config.hideStatus ?? upstream.hideStatus ?? DEFAULT_SETTINGS.hideStatus,
    quietStartup: envLayer.quietStartup ?? config.quietStartup ?? upstream.quietStartup ?? DEFAULT_SETTINGS.quietStartup,
    subagentMatcher: envLayer.subagentMatcher ?? config.subagentMatcher ?? upstream.subagentMatcher ?? DEFAULT_SETTINGS.subagentMatcher,
  }
  return validateSettings(merged)
}

const configDefaults = resolveSettings({
  env: {},
  upstream: readUpstreamConfigSync(upstreamConfigPath()),
})

/** The Loader entry's editable preferences, also projected through ConfigForms. */
export const Config = Schema.object({
  defaultMode: Schema.union(PONYTAIL_MODES.map(mode => Schema.const(mode)))
    .default(configDefaults.defaultMode)
    .volatile()
    .description('Default Ponytail mode for new sessions.'),
  hideStatus: Schema.boolean()
    .default(configDefaults.hideStatus)
    .volatile()
    .description('Legacy compatibility value; Ponytail no longer injects a composer control.'),
  quietStartup: Schema.boolean()
    .default(configDefaults.quietStartup)
    .volatile()
    .description('Hide the browser session-start notice by default.'),
  // Keep regex validation on the Host only: the official form projection loses transform callbacks.
  subagentMatcher: Schema.transform(
    Schema.string(),
    value => {
      new RegExp(value, 'i')
      return value
    },
    true,
  )
    .default(configDefaults.subagentMatcher)
    .description('Case-insensitive unanchored regular expression over agentPreset.'),
})
