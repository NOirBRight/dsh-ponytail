import { describe, expect, it } from 'vitest'
import { apply } from '../src/client/index.tsx'

describe('Ponytail browser contribution', () => {
  it('registers the bundle preference page and frame overlay through ConfigForms', () => {
    const injected: string[] = []
    const ctx = {
      effect: (effect: () => void) => { effect() },
      locale: { register: () => {} },
      configForms: { get: () => ({}) },
      slots: {
        inject: (name: string) => { injected.push(name) },
        register: () => ({}),
      },
    }
    apply(ctx as never)
    expect(injected).toEqual(['plugins.bundle.config', 'shell.overlay'])
  })
})
