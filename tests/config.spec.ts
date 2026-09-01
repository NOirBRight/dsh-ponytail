import { describe, expect, it } from 'vitest'
import { compileSubagentMatcher, DEFAULT_SETTINGS, resolveSettings, upstreamConfigPath } from '../src/config.ts'

describe('ponytail settings precedence', () => {
  it('resolves env over DSH over upstream over defaults', () => {
    expect(resolveSettings({
      env: { PONYTAIL_DEFAULT_MODE: 'LITE', PONYTAIL_HIDE_STATUS: 'false' },
      dsh: { defaultMode: 'ultra', hideStatus: true, quietStartup: true, subagentMatcher: 'worker' },
      upstream: { defaultMode: 'off', hideStatus: true, quietStartup: false, subagentMatcher: 'explore' },
    })).toEqual({ defaultMode: 'lite', hideStatus: false, quietStartup: true, subagentMatcher: 'worker' })
    expect(DEFAULT_SETTINGS).toEqual({ defaultMode: 'full', hideStatus: false, quietStartup: false, subagentMatcher: '' })
  })

  it('validates the matcher at resolution time', () => {
    expect(() => resolveSettings({ dsh: { subagentMatcher: '[' } })).toThrow(/valid regular expression/)
    expect(() => compileSubagentMatcher('')).not.toThrow()
  })

  it('uses XDG_CONFIG_HOME for upstream compatibility', () => {
    expect(upstreamConfigPath({ XDG_CONFIG_HOME: '/tmp/config' }, '/home/test')).toBe('/tmp/config/ponytail/config.json')
  })
})
