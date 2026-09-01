import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(new URL('..', import.meta.url).pathname)
const packageManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const temporary = await mkdtemp(join(tmpdir(), 'dsh-ponytail-install-'))
const app = join(temporary, 'consumer')
await mkdir(app)

try {
  execFileSync('pnpm', ['pack', '--pack-destination', temporary], { cwd: root, stdio: 'inherit' })
  const archive = join(temporary, `${packageManifest.name}-${packageManifest.version}.tgz`)
  execFileSync('pnpm', ['add', '--ignore-scripts', '--dir', app, archive], { cwd: root, stdio: 'inherit' })

  const installedRoot = join(app, 'node_modules', packageManifest.name)
  const manifest = JSON.parse(await readFile(join(installedRoot, 'package.json'), 'utf8'))
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal((await import(pathToFileURL(join(installedRoot, 'lib/index.js')).href)).name, 'dsh-ponytail')
  await readFile(join(installedRoot, 'cordis.patch.yml'))
  await readFile(join(installedRoot, 'skills/ponytail/SKILL.md'))
  console.log('install smoke passed: packed bundle installs and imports from a clean consumer')
} finally {
  await rm(temporary, { recursive: true, force: true })
}
