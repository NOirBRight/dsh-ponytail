/** Session event and projection definitions for Ponytail mode. */

import { z } from 'zod'
import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { PonytailMode } from './mode.ts'

/** Why a mode event was written. */
export type PonytailModeSource = 'default' | 'command' | 'natural-language' | 'inherit' | 'pending'

/** Whole post-change value stored by every `ponytail/mode` event. */
export interface PonytailModeEvent {
  mode: PonytailMode
  pending: PonytailMode | null
  source: PonytailModeSource
  inheritedFrom: SessionId | null
}

/** Host-side folded state. */
export interface PonytailUnitState extends PonytailModeEvent {}

/** Browser-facing projection value. */
export interface PonytailProjection {
  mode: PonytailMode
  pending: PonytailMode | null
}

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Complete current and pending Ponytail mode after this event. */
    'ponytail/mode': PonytailModeEvent
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    /** Folded Ponytail mode state. */
    ponytail: PonytailUnitState
  }
  interface SessionProjectionMap {
    /** Current mode plus pending next-step selection. */
    ponytail: PonytailProjection
  }
}

const modeSchema = z.enum(['off', 'lite', 'full', 'ultra'])
const sourceSchema = z.enum(['default', 'command', 'natural-language', 'inherit', 'pending'])
const sessionIdSchema = z.string().transform(value => value as SessionId)
const stateSchema = z.object({
  mode: modeSchema,
  pending: modeSchema.nullable(),
  source: sourceSchema,
  inheritedFrom: sessionIdSchema.nullable(),
}).strict()
const viewSchema = z.object({ mode: modeSchema, pending: modeSchema.nullable() }).strict()

/** Build the registry definition with the deployment's settings default. */
export function createPonytailProjectionDefinition(defaultMode: PonytailMode) {
  const init = (_header: SessionHeader): PonytailUnitState => ({
    mode: defaultMode,
    pending: null,
    source: 'default',
    inheritedFrom: null,
  })
  return {
    key: 'ponytail',
    stateVersion: 1,
    stateSchema,
    init,
    apply: (state, event: SessionEvent) => {
      if (event.type !== 'ponytail/mode') return state
      return { ...event.data }
    },
    wire: {
      viewSchema,
      view: state => ({ mode: state.mode, pending: state.pending }),
    },
  } satisfies Omit<ProjectionDefinition<'ponytail', PonytailUnitState>, 'wire'> & {
    wire: NonNullable<ProjectionDefinition<'ponytail', PonytailUnitState>['wire']>
  }
}

/** Read the effective target represented by a projection. */
export function targetMode(state: Pick<PonytailUnitState, 'mode' | 'pending'>): PonytailMode {
  return state.pending ?? state.mode
}
