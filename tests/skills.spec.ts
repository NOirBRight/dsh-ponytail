import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { discoverBundledSkills, parseFrontmatter, PONYTAIL_SKILL_NAMES } from '../src/skills.ts'

describe('bundled Ponytail skills', () => {
  it('discovers exactly the six upstream skills with frontmatter removed', () => {
    const skills = discoverBundledSkills()
    expect(skills.map(skill => skill.name)).toEqual([...PONYTAIL_SKILL_NAMES].sort())
    expect(skills.every(skill => !skill.content.startsWith('---'))).toBe(true)
    expect(skills.every(skill => skill.provider === 'dsh-ponytail')).toBe(true)
    expect(skills.find(skill => skill.name === 'ponytail')?.invocation).toEqual({ modelInvocable: false, userInvocable: true })
    expect(skills.filter(skill => skill.name !== 'ponytail').every(skill => skill.invocation?.modelInvocable)).toBe(true)
  })

  it('retains multiline descriptions and metadata', () => {
    const parsed = parseFrontmatter('---\nname: demo\ndescription: >\n  first line\n  second line\nlicense: MIT\n---\n\nBody\n')
    expect(parsed.frontmatter.name).toBe('demo')
    expect(parsed.frontmatter.description).toBe('first line second line')
    expect(parsed.frontmatter.metadata.license).toBe('MIT')
    expect(parsed.body).toBe('Body\n')
  })

  it('matches the pinned upstream content hashes', () => {
    const provenance = readFileSync(fileURLToPath(new URL('../UPSTREAM.md', import.meta.url)), 'utf8')
    for (const skill of PONYTAIL_SKILL_NAMES) {
      const path = fileURLToPath(new URL(`../skills/${skill}/SKILL.md`, import.meta.url))
      const digest = createHash('sha256').update(readFileSync(path)).digest('hex')
      expect(provenance).toMatch(new RegExp(`skills/${skill}/SKILL\\.md\\s+${digest}`))
    }
  })
})
