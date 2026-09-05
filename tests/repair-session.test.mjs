import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zstdCompressSync } from 'node:zlib'
import { repairFile, repairText, decodeZstd } from '../scripts/repair-session.mjs'

test('only legacy Ponytail events change; malformed JSON refuses repair', () => {
  const other = '{ "type": "other/required", "data": {} }\n'
  assert.equal(repairText(other).text, other)
  assert.throws(() => repairText('{broken'))
  assert.throws(() => repairText('{"type":"ponytail/mode","ignorable":false}'))
})

for (const compressed of [false, true]) test(`backup and idempotent repair: compressed=${compressed}`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'ponytail-repair-'))
  try {
    const path = join(root, `session.jsonl${compressed ? '.zstd' : ''}`)
    const text = '{"version":0}\n{"type":"ponytail/mode","seq":3,"data":{"mode":"full"}}\n'
    const original = compressed ? Buffer.concat(text.split(/(?<=\n)/).filter(Boolean).map(line => zstdCompressSync(Buffer.from(line)))) : Buffer.from(text)
    await writeFile(path, original)
    assert.deepEqual(await repairFile(path), { changed: 1, applied: false })
    assert.deepEqual(await readFile(path), original)
    const result = await repairFile(path, true)
    assert.deepEqual(await readFile(result.backup), original)
    const bytes = await readFile(path)
    assert.equal((compressed ? decodeZstd(bytes) : bytes).toString(), repairText(text).text)
    assert.deepEqual(await repairFile(path, true), { changed: 0, applied: false })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
