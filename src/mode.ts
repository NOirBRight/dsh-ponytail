/** Pure Ponytail mode vocabulary and user-input matching. */

/** Modes supported by the DSH adapter. */
export const PONYTAIL_MODES = ['off', 'lite', 'full', 'ultra'] as const

/** A session's Ponytail mode. */
export type PonytailMode = typeof PONYTAIL_MODES[number]

/** Normalize a mode supplied by a command, environment, or file. */
export function normalizeMode(value: unknown): PonytailMode | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  return (PONYTAIL_MODES as readonly string[]).includes(normalized)
    ? normalized as PonytailMode
    : undefined
}

/** Normalize a mode or throw an actionable validation error. */
export function requireMode(value: unknown, field = 'mode'): PonytailMode {
  const normalized = normalizeMode(value)
  if (normalized === undefined) {
    throw new Error(`${field} must be one of ${PONYTAIL_MODES.join('|')}`)
  }
  return normalized
}

/**
 * Match the two explicit natural-language deactivation phrases.
 * Matching is whole-message, case-insensitive, and ignores trailing punctuation.
 *
 * @param text - candidate user text.
 * @returns whether the text is an explicit deactivation command.
 */
export function isDeactivationCommand(text: unknown): boolean {
  if (typeof text !== 'string') return false
  const normalized = text.trim().toLowerCase().replace(/[.!?\s]+$/, '')
  return normalized === 'stop ponytail' || normalized === 'normal mode'
}

/** Extract text only when every content block is a text block. */
export function textOnlyContent(content: readonly unknown[]): string | undefined {
  if (content.length === 0) return ''
  let text = ''
  for (const block of content) {
    if (typeof block !== 'object' || block === null || !('type' in block) || block.type !== 'text') {
      return undefined
    }
    if (!('text' in block) || typeof block.text !== 'string') return undefined
    text += block.text
  }
  return text
}
