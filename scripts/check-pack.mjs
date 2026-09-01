import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const destination = '.scratch/pack'
mkdirSync(destination, { recursive: true })
execFileSync('pnpm', ['pack', '--pack-destination', destination], { stdio: 'inherit' })
const archive = readdirSync(destination).filter(name => name.endsWith('.tgz')).sort().at(-1)
if (archive === undefined) throw new Error('pnpm pack did not produce an archive')
const listing = execFileSync('tar', ['-tzf', join(destination, archive)], { encoding: 'utf8' })
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
const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
if (archive !== `${manifest.name}-${manifest.version}.tgz`) throw new Error(`archive name does not match ${manifest.name}@${manifest.version}`)
console.log(`pack smoke passed: ${archive}`)
