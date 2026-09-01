/** Browser half: Ponytail settings card and session-start notice. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '../projection.ts'
import type { PonytailSettings } from '../config.ts'
import { PonytailSettingsCard, type PonytailSettingsCardInjected } from './PonytailSettingsCard.tsx'
import { PonytailStartupNotice } from './PonytailStartupNotice.tsx'
import { en, zh, type PonytailLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Ponytail settings copy. */
    ponytail: PonytailLocaleKey
  }
}

/** Locale namespace owned by this browser half. */
export const NS = 'ponytail'

/** Browser dependencies supplied by alpha.3. */
export const inject = [
  'slots', 'locale', 'settingsScope', 'sessions',
]

/** Build a stable observable view over a settings scope. */
function settingsObservable(scope: SettingsScope<PonytailSettings>): ObservableSnapshot<SettingsScopeSnapshot<PonytailSettings>> {
  return {
    getSnapshot: () => scope.getSnapshot(),
    subscribe: listener => scope.subscribe(listener),
  }
}

/** Convert a complete settings value into one atomic wire mutation. */
function settingOps(value: PonytailSettings): readonly SettingsPathOpView[] {
  return (Object.entries(value) as Array<[string, unknown]>).map(([field, item]) => ({
    op: 'set' as const,
    path: [field],
    value: item,
  })) as unknown as readonly SettingsPathOpView[]
}

/** Mount the Settings contribution over DSH's existing slots. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-ponytail: dictionaries')
  const scope = ctx.settingsScope.bind<PonytailSettings>({ namespace: 'ponytail' })
  const source = settingsObservable(scope)

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'ponytail',
    locale: NS,
    inject: (): PonytailSettingsCardInjected => ({
      hooks: { settings: source },
      save: async value => { await scope.mutate(settingOps(value)) },
      reset: async () => {
        await scope.mutate([
          { op: 'unset', path: ['defaultMode'] },
          { op: 'unset', path: ['hideStatus'] },
          { op: 'unset', path: ['quietStartup'] },
          { op: 'unset', path: ['subagentMatcher'] },
        ])
      },
    }),
  }, PonytailSettingsCard))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'ponytail-startup-notice',
    locale: NS,
  }, (props: PropsRuntime<'shell.overlay'> & PropsLocale<'ponytail'>) => (
    <PonytailStartupNotice {...props} settings={source} />
  )))
}

export { PonytailSettingsCard }
export type { PonytailSettingsCardProps, PonytailSettingsCardInjected } from './PonytailSettingsCard.tsx'
export type { PonytailLocaleKey } from './locales.ts'
