import { readFile } from 'node:fs/promises'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/config.ts'
import { PonytailSettingsCard, type PonytailSettingsCardProps } from '../src/client/PonytailSettingsCard.tsx'
import { formatStartupNotice } from '../src/client/PonytailStartupNotice.tsx'
import { mainViewSessionId } from '../src/client/session-main-view.ts'
import { en, zh } from '../src/client/locales.ts'

const settingsSnapshot = (value = DEFAULT_SETTINGS, writable = true) => ({
  status: 'ready' as const,
  value,
  base: {},
  user: {},
  writable,
  revision: 0,
  mode: 'host' as const,
})

function settingsProps(value = DEFAULT_SETTINGS): PonytailSettingsCardProps {
  return {
    useSettings: () => settingsSnapshot(value),
    save: async () => true,
    reset: async () => true,
    t: (key: keyof typeof zh) => zh[key],
  } as unknown as PonytailSettingsCardProps
}

describe('Ponytail browser surfaces', () => {
  it('keeps Chinese and English dictionaries in sync', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
    expect(zh).not.toHaveProperty('settingsDescription')
    expect(zh).not.toHaveProperty('expandSettings')
    expect(zh).not.toHaveProperty('collapseSettings')
    expect(zh).not.toHaveProperty('settingsTitle')
    expect(zh).not.toHaveProperty('agentsSection')
    expect(zh).not.toHaveProperty('subagentMatcher')
    expect(en).not.toHaveProperty('agentsSection')
    expect(en).not.toHaveProperty('subagentMatcher')
    expect(zh).not.toHaveProperty('startupSection')
    expect(zh).not.toHaveProperty('quietStartup')
    expect(zh).not.toHaveProperty('quietStartupHint')
    expect(en).not.toHaveProperty('startupSection')
    expect(en).not.toHaveProperty('quietStartup')
    expect(en).not.toHaveProperty('quietStartupHint')
  })

  it('formats the localized startup notice without changing the mode', () => {
    expect(formatStartupNotice('full', (key, params) => `${zh[key]}:${String(params?.mode)}`)).toBe('Ponytail 已加载：{mode}:full')
  })

  it('renders the Plugins-page form without the retired Settings collapse chrome', () => {
    const markup = renderToStaticMarkup(<PonytailSettingsCard {...settingsProps()} />)
    expect(markup).toContain('新会话默认模式')
    expect(markup).toContain('保存')
    expect(markup).not.toContain('aria-expanded')
    expect(markup).not.toContain('展开 Ponytail 设置')
    expect(markup).not.toContain('隐藏启动提示')
    expect(markup).not.toContain('隐藏会话模式控件')
    expect(markup).not.toContain('🐴')
  })

  it('renders nothing when the Plugins page asks the unused summary view', () => {
    const markup = renderToStaticMarkup(<PonytailSettingsCard {...settingsProps()} view="summary" />)
    expect(markup).toBe('')
  })

  it('reads the main-view Session from retainedBy occupancy', () => {
    expect(mainViewSessionId({
      byId: {
        other: { retainedBy: {} },
        live: { retainedBy: { mainView: 1 } },
      },
    })).toBe('live')
    expect(mainViewSessionId({ byId: {} })).toBeUndefined()
  })

  it('keeps the settings sheet usable in narrow mobile containers', async () => {
    const css = await readFile(new URL('../src/client/PonytailSettingsCard.module.css', import.meta.url), 'utf8')
    expect(css).toContain('container-type: inline-size')
    expect(css).toContain('@container (max-width: 560px)')
    expect(css).toContain('min-height: 44px')
    expect(css).not.toContain('.pluginCard')
    expect(css).not.toContain('.pluginHeader')
  })
})
