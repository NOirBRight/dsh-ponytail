import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const destination = '.scratch/pack'
mkdirSync(destination, { recursive: true })
execFileSync('pnpm', ['pack', '--pack-destination', destination], { stdio: 'inherit' })
const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
const archive = `${manifest.name}-${manifest.version}.tgz`
const archivePath = join(destination, archive)
if (!existsSync(archivePath)) throw new Error(`pnpm pack did not produce ${archive}`)
const packed = JSON.parse(execFileSync('tar', ['-xOzf', archivePath, 'package/package.json'], { encoding: 'utf8' }))
for (const section of ['dependencies', 'optionalDependencies', 'devDependencies', 'peerDependencies']) {
  for (const [name, range] of Object.entries(packed[section] ?? {})) {
    if (name !== '@deepseek-ai/dsh' && !name.startsWith('@deepseek-ai/dsh-')) continue
    if (typeof range !== 'string' || !/^>=\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(range)) {
      throw new Error(`${section}.${name} must use an unbounded >= lower range`)
    }
  }
}
const listing = execFileSync('tar', ['-tzf', archivePath], { encoding: 'utf8' })
const requiredFiles = [
  'package/cordis.patch.yml',
  'package/lib/index.js',
  'package/lib/client.js',
  'package/README.md',
  'package/README.zh.md',
  'package/DESIGN.md',
  'package/UPSTREAM.md',
  ...['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help']
    .map(name => `package/skills/${name}/SKILL.md`),
]
for (const required of requiredFiles) {
  if (!listing.split('\n').includes(required)) throw new Error(`packed archive is missing ${required}`)
}
if (listing.includes('node_modules/') || listing.includes('src/')) throw new Error('packed archive contains development-only files')
console.log(`pack smoke passed: ${archive}`)
