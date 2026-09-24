/** Session list occupancy used by the startup notice. */

import type { PonytailMode } from '../mode.ts'

/**
 * Occupancy facts Alpha.2 uses instead of `SessionListState.current`.
 * Host `SessionListState` is a compile-target duck type (`byId` is opaque).
 */
export interface SessionListMainViewRow {
  readonly retainedBy?: { readonly mainView?: number }
  readonly projectionValues?: {
    readonly ponytail?: { readonly mode?: PonytailMode }
  }
}

/** Alpha.2 session-list facts needed to recover the main-view selection. */
export interface SessionListMainViewState {
  readonly byId: object
}

function asRow(row: unknown): SessionListMainViewRow | undefined {
  return row !== null && typeof row === 'object' ? row : undefined
}

/**
 * Return the Session occupying the main view.
 *
 * Alpha.2 represents occupancy with a positive `retainedBy.mainView` count.
 */
export function mainViewSessionId(state: SessionListMainViewState): string | undefined {
  for (const [id, row] of Object.entries(state.byId)) {
    if ((asRow(row)?.retainedBy?.mainView ?? 0) > 0) return id
  }
  return undefined
}

/** Effective Ponytail mode projected onto the main-view Session. */
export function projectedPonytailMode(state: SessionListMainViewState): PonytailMode | undefined {
  const id = mainViewSessionId(state)
  return id === undefined ? undefined : asRow((state.byId as Record<string, unknown>)[id])?.projectionValues?.ponytail?.mode
}
