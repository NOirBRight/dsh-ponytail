import { describe, expect, it } from 'vitest'
import { apply } from '../src/client/index.tsx'

describe('Ponytail browser contribution', () => {
  it('registers settings and the frame overlay while leaving composer slots untouched', () => {
    const injected: string[] = []
    const ctx = {
      effect: (effect: () => void) => { effect() },
      locale: { register: () => {} },
      settingsScope: { bind: () => ({ getSnapshot: () => ({ status: 'ready', value: undefined, writable: true, revision: 0 }), subscribe: () => () => {} }) },
      slots: {
        inject: (name: string) => { injected.push(name) },
        register: () => ({}),
      },
    }
    apply(ctx as never)
    expect(injected).toEqual(['settings.plugin.item', 'shell.overlay'])
  })
})
