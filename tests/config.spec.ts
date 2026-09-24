import { describe, expect, it } from 'vitest'
import { Config, compileSubagentMatcher, DEFAULT_SETTINGS, resolveSettings, upstreamConfigPath } from '../src/config.ts'

describe('Ponytail Loader Config precedence', () => {
  it('resolves env over Loader Config over upstream over defaults', () => {
    expect(resolveSettings({
      env: { PONYTAIL_DEFAULT_MODE: 'LITE', PONYTAIL_HIDE_STATUS: 'false' },
      config: { defaultMode: 'ultra', hideStatus: true, quietStartup: true, subagentMatcher: 'worker' },
      upstream: { defaultMode: 'off', hideStatus: true, quietStartup: false, subagentMatcher: 'explore' },
    })).toEqual({ defaultMode: 'lite', hideStatus: false, quietStartup: true, subagentMatcher: 'worker' })
    expect(DEFAULT_SETTINGS).toEqual({ defaultMode: 'full', hideStatus: false, quietStartup: true, subagentMatcher: '' })
    expect(resolveSettings({ env: {} }).quietStartup).toBe(true)
  })

  it('validates the matcher at resolution time', () => {
    expect(() => resolveSettings({ config: { subagentMatcher: '[' } })).toThrow(/valid regular expression/)
    expect(() => compileSubagentMatcher('')).not.toThrow()
  })

  it('uses volatile Loader fields while runtime validates the matcher', () => {
    const config = Config({ defaultMode: 'ultra', subagentMatcher: 'worker' })
    expect(config.defaultMode.get()).toBe('ultra')
    expect(config.hideStatus.get()).toBeTypeOf('boolean')
    expect(config.quietStartup.get()).toBeTypeOf('boolean')
    expect(config.subagentMatcher.get()).toBe('worker')
  })

  it('uses XDG_CONFIG_HOME for upstream compatibility', () => {
    expect(upstreamConfigPath({ XDG_CONFIG_HOME: '/tmp/config' }, '/home/test')).toBe('/tmp/config/ponytail/config.json')
  })
})
