import { readFile } from 'node:fs/promises'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/config.ts'
import { PonytailSettingsCard, type PonytailSettingsCardProps } from '../src/client/PonytailSettingsCard.tsx'
import { formatStartupNotice } from '../src/client/PonytailStartupNotice.tsx'
import { en, zh } from '../src/client/locales.ts'

const settingsSnapshot = (value = DEFAULT_SETTINGS, writable = true) => ({
  status: 'ready' as const,
  value,
  writable,
  revision: 0,
})

function settingsProps(value = DEFAULT_SETTINGS): PonytailSettingsCardProps {
  return {
    useSettings: () => settingsSnapshot(value),
    save: async () => {},
    reset: async () => {},
    t: (key: keyof typeof zh) => zh[key],
  } as unknown as PonytailSettingsCardProps
}

describe('Ponytail browser surfaces', () => {
  it('keeps Chinese and English dictionaries in sync', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('formats the localized startup notice without changing the mode', () => {
    expect(formatStartupNotice('full', (key, params) => `${zh[key]}:${String(params?.mode)}`)).toBe('Ponytail 已加载：{mode}:full')
  })

  it('renders a collapsed plugin card without composer-only controls', () => {
    const markup = renderToStaticMarkup(<PonytailSettingsCard {...settingsProps()} />)
    expect(markup).toContain('Ponytail')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('展开 Ponytail 设置')
    expect(markup).not.toContain('新会话默认模式')
    expect(markup).not.toContain('隐藏启动提示')
    expect(markup).not.toContain('保存')
    expect(markup).not.toContain('隐藏会话模式控件')
    expect(markup).not.toContain('🐴')
  })

  it('keeps the settings sheet usable in narrow mobile containers', async () => {
    const css = await readFile(new URL('../src/client/PonytailSettingsCard.module.css', import.meta.url), 'utf8')
    expect(css).toContain('container-type: inline-size')
    expect(css).toContain('@container (max-width: 560px)')
    expect(css).toContain('min-height: 44px')
    expect(css).toContain('.pluginCard')
    expect(css).toContain('.pluginHeader')
  })
})
