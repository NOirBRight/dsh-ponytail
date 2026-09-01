import { describe, expect, it } from 'vitest'
import { buildPolicy, filterSkillBodyForMode } from '../src/policy.ts'

const fixture = `---\nname: ponytail\n---\n\n| **Lite** | small |\n| **Full** | medium |\n| **Ultra** | large |\n\n- Lite: "short"\n- Full: "balanced"\n- Ultra: "strict"\n- Full: keep this ordinary prose\n`

describe('Ponytail prompt policy', () => {
  it('keeps common rules and only the selected intensity row/example', () => {
    const full = filterSkillBodyForMode(fixture, 'full')
    expect(full).toContain('| **Full** | medium |')
    expect(full).not.toContain('| **Lite** |')
    expect(full).toContain('- Full: "balanced"')
    expect(full).toContain('- Full: keep this ordinary prose')
    expect(full).not.toContain('name: ponytail')
  })

  it('does not inject policy in off mode', () => {
    expect(buildPolicy('off', fixture)).toBe('')
    expect(buildPolicy('lite', fixture)).toMatch(/^PONYTAIL MODE ACTIVE — level: lite/)
  })
})
