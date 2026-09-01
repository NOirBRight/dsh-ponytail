/** Discover and register the six pinned upstream SKILL.md files. */

import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'

const SKILLS_ROOT = fileURLToPath(new URL('../skills/', import.meta.url))

/** Names shipped from the upstream Ponytail repository. */
export const PONYTAIL_SKILL_NAMES = ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help'] as const

interface Frontmatter {
  name?: string
  description?: string
  metadata: Record<string, unknown>
}

/** Parse the small YAML frontmatter vocabulary used by upstream skills. */
export function parseFrontmatter(text: string): { frontmatter: Frontmatter; body: string } {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/m.exec(text)
  if (match === null) return { frontmatter: { metadata: {} }, body: text }
  const lines = match[1]?.split(/\r?\n/) ?? []
  const metadata: Record<string, unknown> = {}
  let name: string | undefined
  let description: string | undefined
  let current: 'description' | undefined
  for (const line of lines) {
    const key = /^(\w[\w-]*):\s*(.*)$/.exec(line)
    if (key !== null) {
      const rawKey = key[1]
      const rawValue = key[2]
      if (rawKey === undefined || rawValue === undefined) continue
      current = rawKey === 'description' && (rawValue === '>' || rawValue === '|') ? 'description' : undefined
      if (rawKey === 'name') name = rawValue.trim()
      else if (rawKey === 'description' && current === undefined) description = rawValue.trim()
      else if (rawKey !== 'description') metadata[rawKey] = rawValue.trim()
      continue
    }
    if (current === 'description' && line.trim() !== '') description = `${description ?? ''}${description === undefined ? '' : ' '}${line.trim()}`
  }
  const frontmatter: Frontmatter = { metadata }
  if (name !== undefined) frontmatter.name = name
  if (description !== undefined) frontmatter.description = description
  return { frontmatter, body: match[2] ?? '' }
}

/** Discover every direct skill-directory SKILL.md file in deterministic order. */
export function discoverBundledSkills(root = SKILLS_ROOT): SkillRegistration[] {
  const registrations: SkillRegistration[] = []
  for (const directory of readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(root, directory.name, 'SKILL.md')
    let source: string
    try {
      source = readFileSync(path, 'utf8')
    } catch (error) {
      // Non-skill directories are allowed; an expected Ponytail skill is
      // checked after discovery so a damaged bundle fails at load.
      if ((error as NodeJS.ErrnoException | null)?.code !== 'ENOENT') throw error
      continue
    }
    const parsed = parseFrontmatter(source)
    const name = parsed.frontmatter.name ?? basename(directory.name)
    if (!PONYTAIL_SKILL_NAMES.includes(name as typeof PONYTAIL_SKILL_NAMES[number])) continue
    if (registrations.some(skill => skill.name === name)) throw new Error(`duplicate bundled Ponytail skill "${name}"`)
    registrations.push({
      name,
      description: parsed.frontmatter.description ?? name,
      content: parsed.body,
      source: 'bundled',
      provider: 'dsh-ponytail',
      path,
      resourceBase: { kind: 'directory', path: join(root, directory.name) },
      metadata: parsed.frontmatter.metadata,
      invocation: { modelInvocable: true, userInvocable: true },
    })
  }
  const found = new Set(registrations.map(skill => skill.name))
  const missing = PONYTAIL_SKILL_NAMES.filter(name => !found.has(name))
  if (missing.length > 0) throw new Error(`missing bundled Ponytail skill(s): ${missing.join(', ')}`)
  return registrations
}
