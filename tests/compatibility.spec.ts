import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { shouldMountDshRuntime } from '../src/compatibility.ts'

const VERIFIED = new Set(['0.1.7-alpha.2', '0.1.7-rc.1'])

function logger(warnings: string[]) {
  return { warn(message: string): void { warnings.push(message) } }
}

describe('DSH forward compatibility policy', () => {
  it('warns once and still attempts an unverified future runtime', () => {
    const warnings: string[] = []
    let mountAttempts = 0
    const allowed = shouldMountDshRuntime(logger(warnings), 'test-plugin', '9.9.9', VERIFIED)
    if (allowed) mountAttempts += 1
    expect(mountAttempts).toBe(1)
    expect(warnings).toEqual(['[test-plugin] best-effort on unverified runtime 9.9.9'])
  })

  it('blocks only an explicitly reproduced version and leaves a visible reason', () => {
    const warnings: string[] = []
    let mountAttempts = 0
    const allowed = shouldMountDshRuntime(logger(warnings), 'test-plugin', '9.9.9', VERIFIED, {
      '9.9.9': 'reproduced startup failure in the test harness',
    })
    if (allowed) mountAttempts += 1
    expect(mountAttempts).toBe(0)
    expect(warnings).toEqual([
      '[test-plugin] blocked on DSH 9.9.9: reproduced startup failure in the test harness; see package.json#dsh.compatibility.blocklist',
    ])
  })

  it.each([...VERIFIED])('does not warn for verified runtime %s', (version) => {
    const warnings: string[] = []
    expect(shouldMountDshRuntime(logger(warnings), 'test-plugin', version, VERIFIED)).toBe(true)
    expect(warnings).toEqual([])
  })

  it('declares the rc.1 compatibility evidence and open DSH dependency ranges', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      dsh?: { compatibility?: { dshReleases?: Record<string, string> } }
      peerDependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      peerDependenciesMeta?: Record<string, { optional?: boolean }>
    }
    const peers = Object.entries(manifest.peerDependencies ?? {}).filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))
    expect(manifest.peerDependencies?.['@deepseek-ai/cordis']).toBe('>=4.0.4 <5.0.0')
    expect(manifest.devDependencies?.['@deepseek-ai/cordis']).toBe('>=4.0.4 <5.0.0')
    expect(manifest.dsh?.compatibility?.dshReleases).toEqual({
      '0.1.7-alpha.2': 'compatible',
      '0.1.7-rc.1': 'compatible',
    })
    for (const [, version] of Object.entries(manifest.devDependencies ?? {}).filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))) {
      expect(version).toBe('>=0.1.7-alpha.2')
    }
    expect(peers.length).toBeGreaterThan(0)
    for (const [name, range] of peers) {
      expect(range).toBe('>=0.1.7-alpha.2')
      expect(manifest.peerDependenciesMeta?.[name]?.optional).toBe(true)
    }
  })
})
