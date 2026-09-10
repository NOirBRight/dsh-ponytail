import { describe, expect, it } from 'vitest'
import { SESSION_FORMAT_VERSION, type SessionHeader } from '@deepseek-ai/dsh-session'
import { createPonytailProjectionDefinition, targetMode, type PonytailModeEvent } from '../src/projection.ts'

const header: SessionHeader = { version: SESSION_FORMAT_VERSION, id: 'session-test' as never, createdAt: 0, isSeeded: false }
const event = (data: PonytailModeEvent) => ({ type: 'ponytail/mode', time: 1, seq: 0, data }) as never

describe('ponytail projection', () => {
  it('folds complete committed state and exposes pending target', () => {
    const definition = createPonytailProjectionDefinition('full')
    const initial = definition.init(header)
    expect(initial).toMatchObject({ mode: 'full', pending: null, source: 'default' })
    const pending = definition.apply(initial, event({ mode: 'full', pending: 'ultra', source: 'pending', inheritedFrom: null }))
    expect(pending).toMatchObject({ mode: 'full', pending: 'ultra' })
    expect(targetMode(pending)).toBe('ultra')
    const committed = definition.apply(pending, event({ mode: 'ultra', pending: null, source: 'command', inheritedFrom: null }))
    expect(committed).toMatchObject({ mode: 'ultra', pending: null })
  })

  it('keeps unrelated events referentially stable', () => {
    const definition = createPonytailProjectionDefinition('lite')
    const initial = definition.init(header)
    expect(definition.apply(initial, { type: 'turn/start', time: 1, seq: 0, data: {} } as never)).toBe(initial)
  })
})
