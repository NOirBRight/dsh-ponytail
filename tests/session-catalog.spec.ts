import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadHostSessionEventCatalog, registerHostSessionEvent } from '../src/session-catalog.ts'

describe('Host session event catalog', () => {
  it('resolves the profile module and removes the registration on dispose', async () => {
    const profile = await mkdtemp(join(tmpdir(), 'dsh-ponytail-session-catalog-'))
    const moduleDir = join(profile, 'node_modules', '@deepseek-ai', 'dsh-session')
    await mkdir(moduleDir, { recursive: true })
    await writeFile(join(moduleDir, 'package.json'), JSON.stringify({
      name: '@deepseek-ai/dsh-session',
      type: 'module',
      exports: './catalog.mjs',
    }))
    await writeFile(join(moduleDir, 'catalog.mjs'), 'export const KNOWN_SESSION_EVENT_TYPES = new Set()\n')

    try {
      const ctx = { baseUrl: pathToFileURL(profile).href + '/' }
      const catalog = await loadHostSessionEventCatalog(ctx)
      const dispose = await registerHostSessionEvent(ctx, 'ponytail/mode')
      expect(catalog.has('ponytail/mode')).toBe(true)
      dispose()
      expect(catalog.has('ponytail/mode')).toBe(false)
    } finally {
      await rm(profile, { recursive: true, force: true })
    }
  })
})
