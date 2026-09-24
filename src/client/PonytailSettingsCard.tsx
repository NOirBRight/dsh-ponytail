/** Ponytail settings form rendered on the Plugins page bundle card. */

import { useEffect, useState } from 'react'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { PonytailSettings } from '../config.ts'
import type { PonytailMode } from '../mode.ts'
import type { PonytailLocaleKey } from './locales.ts'
import css from './PonytailSettingsCard.module.css'

/** Card actions and the settings snapshot injected by the browser plugin. */
export interface PonytailSettingsCardInjected {
  hooks: {
    settings: ObservableSnapshot<ConfigFormSnapshot<PonytailSettings>>
  }
  save: (value: PonytailMode, expectedRevision?: number) => Promise<boolean>
  reset: (expectedRevision?: number) => Promise<boolean>
}

type ConfigPageForm = {
  readonly state: ConfigFormSnapshot<Record<string, unknown>>
  readonly mutate: ConfigForm<Record<string, unknown>>['mutate']
}

/** Renderer props for the Plugins-page form (`view: 'page'`). */
export type PonytailSettingsCardProps =
  {
    view?: 'summary' | 'page'
    form?: ConfigPageForm | undefined
  }
  & InjectFace<PonytailSettingsCardInjected>
  & PropsLocale<'ponytail'>

const MODES = ['off', 'lite', 'full', 'ultra'] as const satisfies readonly PonytailMode[]
const MODE_DETAILS: Record<PonytailMode, { label: PonytailLocaleKey; hint: PonytailLocaleKey }> = {
  off: { label: 'modeOff', hint: 'modeOffHint' },
  lite: { label: 'modeLite', hint: 'modeLiteHint' },
  full: { label: 'modeFull', hint: 'modeFullHint' },
  ultra: { label: 'modeUltra', hint: 'modeUltraHint' },
}

function cx(...values: Array<string | false | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join(' ')
}

/**
 * Render Ponytail's saveable default-mode picker on the Plugins page.
 * `hideStatus` stays part of Loader Config for compatibility but has no UI
 * control because Ponytail no longer contributes to the composer.
 *
 * @param props - settings snapshot, save/reset callbacks, locale, and view.
 * @returns the form, nothing for `summary`, or an unavailable marker.
 */
export function PonytailSettingsCard({ view = 'page', useSettings, save, reset, t }: PonytailSettingsCardProps) {
  const snapshot = useSettings(value => value)
  const source = snapshot.value?.defaultMode
  const [draft, setDraft] = useState<PonytailMode | undefined>(source)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty && source !== undefined) setDraft(source)
  }, [dirty, source])

  if (view === 'summary') return null
  if (snapshot.status === 'unavailable') return null
  if (draft === undefined || source === undefined) return <p className={css.unavailable}>{t('unavailable')}</p>

  const disabled = saving || !snapshot.writable
  const edit = (value: PonytailMode): void => {
    setDraft(value)
    setDirty(true)
    setError(null)
  }
  const submit = (): void => {
    setSaving(true)
    setError(null)
    void save(draft, snapshot.revision).then((accepted) => {
      setSaving(false)
      if (!accepted) {
        setError(t('writeRejected'))
        return
      }
      setDirty(false)
    }, (reason: unknown) => {
      setSaving(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  const clear = (): void => {
    setSaving(true)
    setError(null)
    void reset(snapshot.revision).then((accepted) => {
      setSaving(false)
      if (!accepted) {
        setError(t('writeRejected'))
        return
      }
      setDirty(false)
    }, (reason: unknown) => {
      setSaving(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  return <div className={css.pluginBody}>
    <div className={css.section}>
      <div className={css.bodyMeta}>
        <span className={cx(css.syncBadge, dirty ? css.syncBadgeDirty : css.syncBadgeReady)} role="status">
          <i className={css.syncDot} aria-hidden="true" />
          {dirty ? t('unsaved') : t('synced')}
        </span>
      </div>

      <section className={css.card} aria-labelledby="ponytail-default-heading">
        <div className={css.sectionBlock}>
          <div className={css.sectionHeader}>
            <p className={css.sectionLabel}>{t('defaultBehavior')}</p>
            <h3 className={css.sectionTitle} id="ponytail-default-heading">{t('defaultMode')}</h3>
            <p className={css.sectionHint}>{t('defaultModeHint')}</p>
          </div>
          <div className={css.modeGrid} role="group" aria-label={t('defaultMode')}>
            {MODES.map(mode => {
              const selected = draft === mode
              const details = MODE_DETAILS[mode]
              return <button
                key={mode}
                type="button"
                className={cx(css.modeButton, selected && css.modeButtonSelected)}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => { edit(mode) }}
              >
                <span className={css.modeName}>
                  <strong>{t(details.label)}</strong>
                  {selected ? <span className={css.currentBadge}>{t('currentMode')}</span> : null}
                </span>
                <span className={css.modeHint}>{t(details.hint)}</span>
              </button>
            })}
          </div>
        </div>

        <footer className={css.cardFooter}>
          <div className={css.footerStatus}>
            {error === null ? <span>{dirty ? t('unsaved') : t('synced')}</span> : <span className={css.error} role="alert" title={error}>{error}</span>}
          </div>
          <div className={css.actions}>
            <button type="button" className={cx(css.button, css.secondaryButton)} disabled={disabled} onClick={clear}>{t('reset')}</button>
            <button type="button" className={cx(css.button, css.primaryButton)} disabled={!dirty || disabled} onClick={submit}>{saving ? t('saving') : t('save')}</button>
          </div>
        </footer>
      </section>
    </div>
  </div>
}
