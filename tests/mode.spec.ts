import { describe, expect, it } from 'vitest'
import { isDeactivationCommand, normalizeMode, requireMode, textOnlyContent } from '../src/mode.ts'

describe('ponytail mode input', () => {
  it('normalizes the four runtime modes', () => {
    expect(normalizeMode(' FULL ')).toBe('full')
    expect(normalizeMode('review')).toBeUndefined()
    expect(requireMode('ultra')).toBe('ultra')
  })

  it('rejects invalid modes', () => {
    expect(() => requireMode('review')).toThrow(/off\|lite\|full\|ultra/)
  })

  it('matches only standalone natural-language deactivation', () => {
    expect(isDeactivationCommand(' STOP PONYTAIL!!! ')).toBe(true)
    expect(isDeactivationCommand('normal mode?')).toBe(true)
    expect(isDeactivationCommand('add a normal mode toggle')).toBe(false)
    expect(isDeactivationCommand('stop ponytail and continue')).toBe(false)
  })

  it('extracts text-only messages and ignores attachments', () => {
    expect(textOnlyContent([{ type: 'text', text: 'stop ' }, { type: 'text', text: 'ponytail' }])).toBe('stop ponytail')
    expect(textOnlyContent([{ type: 'text', text: 'stop ponytail' }, { type: 'image' }])).toBeUndefined()
  })
})
