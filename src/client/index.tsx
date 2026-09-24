/** Browser half: Ponytail's Loader preference page and session-start notice. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
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
import { PONYTAIL_CONFIG_ENTRY_ID } from '../config-entry.ts'
import type { PonytailSettings } from '../config.ts'
import { PonytailSettingsCard, type PonytailSettingsCardInjected } from './PonytailSettingsCard.tsx'
import { PonytailStartupNotice } from './PonytailStartupNotice.tsx'
import { en, zh, type PonytailLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Ponytail settings copy. */
    ponytail: PonytailLocaleKey
  }
  interface SlotMap {
    /** Bundle configuration on the Plugins page, keyed by package name. */
    'plugins.bundle.config': {
      kind: 'keyed'
      scope: 'root'
      owner: {
        readonly view: 'summary' | 'page'
        readonly form?: {
          readonly state: ConfigFormSnapshot<Record<string, unknown>>
          readonly mutate: ConfigForm<Record<string, unknown>>['mutate']
        } | undefined
      }
    }
  }
}

/** Locale namespace owned by this browser half. */
export const NS = 'ponytail'

export const inject = [
  'slots', 'locale', 'configForms', 'sessions',
]

/** Build a stable observable view over the ConfigForm snapshot. */
function settingsObservable(form: ConfigForm<PonytailSettings>): ObservableSnapshot<ConfigFormSnapshot<PonytailSettings>> {
  return {
    getSnapshot: () => form.getSnapshot(),
    subscribe: listener => form.subscribe(listener),
  }
}

type SettingsSlotName = 'plugins.bundle.config'

function settingsCard(
  ctx: ClientContext,
  name: SettingsSlotName,
  key: string,
  source: ObservableSnapshot<ConfigFormSnapshot<PonytailSettings>>,
  form: ConfigForm<PonytailSettings>,
): void {
  ctx.slots.inject(name, () => ctx.slots.register({
    name,
    key,
    locale: NS,
    inject: (): PonytailSettingsCardInjected => ({
      hooks: { settings: source },
      save: (value, expectedRevision) => form.mutate([
        { op: 'set', path: ['defaultMode'], value },
      ], expectedRevision),
      reset: expectedRevision => form.mutate([
        { op: 'unset', path: ['defaultMode'] },
        { op: 'unset', path: ['hideStatus'] },
        { op: 'unset', path: ['quietStartup'] },
        { op: 'unset', path: ['subagentMatcher'] },
      ], expectedRevision),
    }),
  }, PonytailSettingsCard))
}


/**
 * Mount the mode form on the bundle Plugins page and read the same Loader
 * ConfigForm for the startup notice.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-ponytail: dictionaries')
  const form = ctx.configForms.get<PonytailSettings>(PONYTAIL_CONFIG_ENTRY_ID)
  const source = settingsObservable(form)

  settingsCard(ctx, 'plugins.bundle.config', 'dsh-ponytail', source, form)

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
