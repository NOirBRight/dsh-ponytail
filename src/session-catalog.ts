import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'

interface SessionModule {
  KNOWN_SESSION_EVENT_TYPES?: unknown
}

/** Resolve the session package from the Host's profile rather than this plugin's workspace. */
function hostSessionModuleUrl(ctx: Pick<Context, 'baseUrl'>): string {
  const anchor = ctx.baseUrl === undefined
    ? new URL('../package.json', import.meta.url)
    : new URL('package.json', ctx.baseUrl)
  const require = createRequire(anchor)
  return pathToFileURL(require.resolve('@deepseek-ai/dsh-session')).href
}

/**
 * Load the Host's mutable session event catalog.
 *
 * @param ctx - Host context whose base URL anchors package resolution.
 * @returns the mutable catalog exported by the resolved Host package.
 * @throws {Error} when the Host package does not expose a Set catalog.
 */
export async function loadHostSessionEventCatalog(ctx: Pick<Context, 'baseUrl'>): Promise<Set<string>> {
  const module = await import(hostSessionModuleUrl(ctx)) as SessionModule
  const catalog = module.KNOWN_SESSION_EVENT_TYPES
  if (!(catalog instanceof Set)) {
    throw new Error('dsh-ponytail requires the Host dsh-session event catalog')
  }
  return catalog as Set<string>
}

/**
 * Register one downstream event in the Host persistence vocabulary.
 *
 * The Host's loader may resolve this package from a profile while the plugin
 * source tree has its own development copy. Resolving from `ctx.baseUrl` keeps
 * the mutable catalog shared with the persistence reader in both layouts.
 *
 * @param ctx - Host context whose base URL anchors package resolution.
 * @param eventType - downstream event name to allow during session recovery.
 * @returns a disposer that removes the event name from the same catalog.
 */
export async function registerHostSessionEvent(ctx: Pick<Context, 'baseUrl'>, eventType: string): Promise<() => void> {
  const catalog = await loadHostSessionEventCatalog(ctx)
  catalog.add(eventType)
  return () => { catalog.delete(eventType) }
}
