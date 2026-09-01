/** Render the upstream Ponytail skill as a dynamic DSH system-prompt section. */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { normalizeMode, type PonytailMode } from './mode.ts'

const SKILL_PATH = fileURLToPath(new URL('../skills/ponytail/SKILL.md', import.meta.url))

/** Remove YAML frontmatter without changing the upstream body. */
export function withoutFrontmatter(text: string): string {
  return text.replace(/^---[\s\S]*?---\s*/, '')
}

/** Keep the intensity row and worked example for the selected runtime level. */
export function filterSkillBodyForMode(body: string, mode: PonytailMode): string {
  const effective = normalizeMode(mode) ?? 'full'
  return withoutFrontmatter(body).split(/\r?\n/).filter((line) => {
    const tableLabel = /^\|\s*\*\*(.+?)\*\*\s*\|/.exec(line)
    if (tableLabel !== null) {
      const label = normalizeMode(tableLabel[1]?.trim())
      if (label !== undefined) return label === effective
    }
    const exampleLabel = /^-\s*([^:]+):\s*"/.exec(line)
    if (exampleLabel !== null) {
      const label = normalizeMode(exampleLabel[1]?.trim())
      if (label !== undefined) return label === effective
    }
    return true
  }).join('\n')
}

/** Read and render the pinned upstream skill for one active mode. */
export function buildPolicy(mode: PonytailMode, skillText = readSkillText()): string {
  if (mode === 'off') return ''
  return `PONYTAIL MODE ACTIVE — level: ${mode}\n\n${filterSkillBodyForMode(skillText, mode)}`
}

/** Read the shipped skill; the fallback is intentionally short and safe. */
export function readSkillText(): string {
  try {
    return readFileSync(SKILL_PATH, 'utf8')
  } catch {
    return '# Ponytail\n\nUse the simplest solution that works. Preserve validation, error handling, security, accessibility, and explicit user requirements.'
  }
}
