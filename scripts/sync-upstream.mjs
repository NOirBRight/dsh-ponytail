import { cpSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const source = process.env.PONYTAIL_SOURCE
if (source === undefined || source === '') {
  throw new Error('Set PONYTAIL_SOURCE to a local Ponytail checkout before syncing.')
}
const root = resolve(source)
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (packageJson.version !== '4.9.0') throw new Error(`Expected Ponytail 4.9.0, got ${String(packageJson.version)}`)
for (const name of ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help']) {
  const from = join(root, 'skills', name, 'SKILL.md')
  if (!existsSync(from)) throw new Error(`Missing upstream skill: ${from}`)
  cpSync(from, join('skills', name, 'SKILL.md'))
}
console.log(`Synced six Ponytail skills from ${root}`)
