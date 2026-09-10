/** Offline, opt-in repair of legacy Ponytail JSONL logs. Stop their Host before applying. */
import { readFile, writeFile, rename, unlink, stat } from 'node:fs/promises'
import { zstdCompressSync, constants } from 'node:zlib'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

/** Decode all concatenated frames; Node 22's one-shot API stops at the first frame. */
export function decodeZstd(bytes) {
  const result = spawnSync('zstd', ['-q', '-d', '-c'], { input: bytes, maxBuffer: 1024 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Zstandard decoding failed: ${result.stderr.toString()}`)
  return result.stdout
}

/** Keep the physical header in its own checksummed frame for Host discovery. */
function encodeZstd(text) {
  const split = text.indexOf('\n') + 1
  if (split === 0) throw new Error('Missing JSONL header newline')
  const compress = value => zstdCompressSync(Buffer.from(value), { params: { [constants.ZSTD_c_checksumFlag]: 1 } })
  return Buffer.concat([compress(text.slice(0, split)), compress(text.slice(split))])
}

/** Preserve every line except the omission-safety marker on legacy mode events. */
export function repairText(text) {
  let changed = 0
  const output = text.split('\n').map(line => {
    if (!line.trim()) return line
    const row = JSON.parse(line)
    if (row.type !== 'ponytail/mode' || row.ignorable === true) return line
    if (row.ignorable !== undefined) throw new Error('Invalid Ponytail ignorable marker')
    changed++
    return JSON.stringify({ ...row, ignorable: true })
  }).join('\n')
  return { text: output, changed }
}

/** Dry-run by default; applying creates an exclusive byte-for-byte backup before atomic replacement. */
export async function repairFile(path, apply = false) {
  // V0 logs are session.jsonl[.zstd]; V1+ generations are session.v<N>.jsonl[.zstd].
  if (!/session(?:\.v\d+)?\.jsonl(?:\.zstd)?$/.test(path)) throw new Error('Expected session.jsonl[.zstd] or session.v<N>.jsonl[.zstd]')
  const original = await readFile(path)
  const compressed = path.endsWith('.zstd')
  const decoded = compressed ? decodeZstd(original) : original
  const result = repairText(new TextDecoder('utf-8', { fatal: true }).decode(decoded))
  if (!apply || result.changed === 0) return { changed: result.changed, applied: false }
  const mode = (await stat(path)).mode & 0o777
  const backup = `${path}.before-ponytail-repair`
  const temporary = `${path}.ponytail-repair-${process.pid}`
  const output = compressed ? encodeZstd(result.text) : Buffer.from(result.text)
  await writeFile(backup, original, { flag: 'wx', mode })
  await writeFile(temporary, output, { flag: 'wx', mode })
  try {
    if (!(await readFile(path)).equals(original)) throw new Error('Session changed during repair; stop its Host and retry')
    await rename(temporary, path)
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error })
  }
  return { changed: result.changed, applied: true, backup }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const apply = args[0] === '--apply'
  const paths = apply ? args.slice(1) : args
  if (paths.length === 0) throw new Error('Usage: node scripts/repair-session.mjs [--apply] /path/to/session[.v<N>].jsonl[.zstd] ...')
  for (const path of paths) console.log(JSON.stringify({ path, ...await repairFile(path, apply) }))
}
