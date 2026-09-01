/** Configuration layers shared by Host, tests, and the browser settings copy. */

import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { requireMode, type PonytailMode } from './mode.ts'

/** User settings owned by the Ponytail DSH plugin. */
export interface PonytailSettings {
  /** Mode used when a new session has no inherited mode. */
  defaultMode: PonytailMode
  /** Legacy compatibility value retained for existing Ponytail configuration. */
  hideStatus: boolean
  /** Suppress only the browser session-start notice. */
  quietStartup: boolean
  /** Unanchored, case-insensitive matcher over `agentPreset`. Empty means all. */
  subagentMatcher: string
}

/** A partial settings source, before schema defaults are applied. */
export type PonytailSettingsLayer = Partial<PonytailSettings>

/** Process defaults shared by every source resolver. */
export const DEFAULT_SETTINGS: PonytailSettings = {
  defaultMode: 'full',
  hideStatus: false,
  quietStartup: false,
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

/** Read a JSON object from the upstream config file; absent/invalid files are empty. */
export async function readUpstreamConfig(path: string): Promise<PonytailSettingsLayer> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') return {}
    throw error
  }
  try {
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
    }
    if (layer.subagentMatcher !== undefined) compileSubagentMatcher(layer.subagentMatcher)
    return layer
  } catch (error) {
    if (error instanceof SyntaxError) return {}
    throw error
  }
}

/** Synchronous counterpart used during Cordis plugin construction. */
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

/** Resolve source layers in the documented env → DSH → upstream → defaults order. */
export function resolveSettings(
  sources: {
    env?: Environment
    dsh?: PonytailSettingsLayer
    upstream?: PonytailSettingsLayer
  } = {},
): PonytailSettings {
  const env = sources.env ?? process.env
  const upstream = sources.upstream ?? {}
  const dsh = sources.dsh ?? {}
  const envLayer: PonytailSettingsLayer = {}
  if (env.PONYTAIL_DEFAULT_MODE !== undefined) envLayer.defaultMode = requireMode(env.PONYTAIL_DEFAULT_MODE, 'PONYTAIL_DEFAULT_MODE')
  const hideStatus = parseBooleanEnvironment(env.PONYTAIL_HIDE_STATUS)
  if (hideStatus !== undefined) envLayer.hideStatus = hideStatus
  const quietStartup = parseBooleanEnvironment(env.PONYTAIL_QUIET_STARTUP)
  if (quietStartup !== undefined) envLayer.quietStartup = quietStartup
  if (env.PONYTAIL_SUBAGENT_MATCHER !== undefined) envLayer.subagentMatcher = env.PONYTAIL_SUBAGENT_MATCHER
  const merged: PonytailSettings = {
    defaultMode: envLayer.defaultMode ?? dsh.defaultMode ?? upstream.defaultMode ?? DEFAULT_SETTINGS.defaultMode,
    hideStatus: envLayer.hideStatus ?? dsh.hideStatus ?? upstream.hideStatus ?? DEFAULT_SETTINGS.hideStatus,
    quietStartup: envLayer.quietStartup ?? dsh.quietStartup ?? upstream.quietStartup ?? DEFAULT_SETTINGS.quietStartup,
    subagentMatcher: envLayer.subagentMatcher ?? dsh.subagentMatcher ?? upstream.subagentMatcher ?? DEFAULT_SETTINGS.subagentMatcher,
  }
  return validateSettings(merged)
}

/** Load the optional upstream file and resolve it with DSH/env sources. */
export async function loadSettings(
  env: Environment = process.env,
  dsh: PonytailSettingsLayer = {},
  home = homedir(),
): Promise<PonytailSettings> {
  const upstream = await readUpstreamConfig(upstreamConfigPath(env, home))
  return resolveSettings({ env, dsh, upstream })
}

/** Synchronous startup resolver used before the Host service is published. */
export function loadSettingsSync(
  env: Environment = process.env,
  dsh: PonytailSettingsLayer = {},
  home = homedir(),
): PonytailSettings {
  return resolveSettings({ env, dsh, upstream: readUpstreamConfigSync(upstreamConfigPath(env, home)) })
}

/** Persist only the DSH user-layer default mode when `/ponytail default` runs. */
export async function writeDefaultMode(path: string, mode: PonytailMode): Promise<void> {
  const normalized = requireMode(mode, 'defaultMode')
  let current: Record<string, unknown> = {}
  try {
    const text = await readFile(path, 'utf8')
    const parsed: unknown = JSON.parse(text.replace(/^\uFEFF/, ''))
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) current = { ...(parsed as Record<string, unknown>) }
  } catch {
    // A new settings document starts empty.
  }
  current.defaultMode = normalized
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
}

/** Synchronous write used by tests and startup-only integrations. */
export function writeDefaultModeSync(path: string, mode: PonytailMode): void {
  const normalized = requireMode(mode, 'defaultMode')
  let current: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) current = { ...(parsed as Record<string, unknown>) }
  } catch {
    // A new settings document starts empty.
  }
  current.defaultMode = normalized
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
}

/** Compile once at the point a new child agent is selected. */
export function matchesSubagent(matcher: string, agentPreset: string | undefined): boolean {
  if (agentPreset === undefined || matcher === '') return true
  return (compileSubagentMatcher(matcher)?.test(agentPreset) ?? true)
}
