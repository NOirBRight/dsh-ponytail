/** Browser startup notice rendered through DSH's frame-wide overlay slot. */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '../projection.ts'
import type { PonytailSettings } from '../config.ts'
import type { PonytailMode } from '../mode.ts'
import css from './PonytailStartupNotice.module.css'

/** Full notice lifetime; the stylesheet uses the same duration for fade-out. */
const NOTICE_MS = 4_000

/** Props for the root-scoped shell overlay entry. */
export type PonytailStartupNoticeProps =
  PropsRuntime<'shell.overlay'>
  & { settings: ObservableSnapshot<SettingsScopeSnapshot<PonytailSettings>> }
  & PropsLocale<'ponytail'>

/** Narrow translator contract used by the pure notice formatter. */
export type StartupNoticeTranslator = (key: 'startupNotice', params?: Record<string, unknown>) => string

/**
 * Format the localized startup copy while keeping mode as data, not state.
 *
 * @param mode - effective mode projected by the Host.
 * @param t - Ponytail locale translator.
 * @returns localized startup notice text.
 */
export function formatStartupNotice(mode: PonytailMode, t: StartupNoticeTranslator): string {
  return t('startupNotice', { mode })
}

/**
 * Show one transient notice when the selected browser session becomes ready.
 * The session id is the de-duplication key, so projection updates and mode
 * changes never replay a startup message. The same component works in the
 * desktop frame and dsh-mobile's replacement frame because both render the
 * official `shell.overlay` slot.
 *
 * @param props - session list, settings, and locale supplied by DSH.
 * @returns a transient notice while startup copy is active.
 */
export function PonytailStartupNotice({ useSessions, settings, t }: PonytailStartupNoticeProps) {
  const currentId = useSessions(state => state.current)
  const currentMode = useSessions(state => {
    const id = state.current
    return id === undefined ? undefined : state.byId[id]?.projectionValues?.ponytail?.mode
  })
  const settingsSnapshot = useSyncExternalStore(settings.subscribe, settings.getSnapshot, settings.getSnapshot)
  const settingsReady = settingsSnapshot.status !== 'loading'
  const quietStartup = settingsSnapshot.value?.quietStartup ?? false
  const seenSession = useRef<typeof currentId>(undefined)
  const sequence = useRef(0)
  const [notice, setNotice] = useState<{ seq: number; text: string } | null>(null)

  useEffect(() => {
    if (notice === null) return
    const timer = globalThis.setTimeout(() => {
      setNotice(value => value?.seq === notice.seq ? null : value)
    }, NOTICE_MS)
    return () => { globalThis.clearTimeout(timer) }
  }, [notice])

  useEffect(() => {
    // Wait for the settings mirror before deciding whether to show the
    // notice; otherwise a persisted quietStartup=true could flash briefly.
    if (!settingsReady) {
      setNotice(null)
      return
    }
    if (currentId === undefined || currentMode === undefined) {
      if (currentId === undefined) {
        seenSession.current = undefined
        setNotice(null)
      } else {
        // A session can be selected before its projection arrives. Hide a
        // previous session's notice until the new session is identifiable.
        setNotice(null)
      }
      return
    }
    if (seenSession.current === currentId) {
      if (quietStartup) setNotice(null)
      return
    }
    seenSession.current = currentId
    if (quietStartup) {
      setNotice(null)
      return
    }
    const seq = sequence.current + 1
    sequence.current = seq
    setNotice({ seq, text: formatStartupNotice(currentMode, t) })
  }, [currentId, currentMode, quietStartup, settingsReady, t])

  if (notice === null) return null
  return <div
    key={notice.seq}
    className={css.notice}
    role="alert"
    aria-live="polite"
    onAnimationEnd={() => {
      setNotice(value => value?.seq === notice.seq ? null : value)
    }}
  >
    <span className={css.icon} aria-hidden="true">🐴</span>
    <span>{notice.text}</span>
  </div>
}
