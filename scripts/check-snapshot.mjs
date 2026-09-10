import { strict as assert } from 'node:assert'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { Loader } from '@deepseek-ai/cordis-plugin-loader'
import { AgentRegistry, assembleContextFor } from '@deepseek-ai/dsh-agent'
import { CommandRuntime } from '@deepseek-ai/dsh-commands'
import { createSystemMessage } from '@deepseek-ai/dsh-llm'
// 0.1.5-rc.1 exports the persistence class as default (official consumers import it by default).
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import { repairFile } from './repair-session.mjs'
import { SessionStore } from '@deepseek-ai/dsh-session'
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import { SkillRegistry } from '@deepseek-ai/dsh-skill'
import { renderPrompt, SystemPrompt } from '@deepseek-ai/dsh-system-prompt'

const root = fileURLToPath(new URL('..', import.meta.url))
const snapshotPath = join(root, 'snapshots', 'ponytail-host.json')
const environmentNames = [
  'PONYTAIL_DEFAULT_MODE',
  'PONYTAIL_HIDE_STATUS',
  'PONYTAIL_QUIET_STARTUP',
  'PONYTAIL_SUBAGENT_MATCHER',
  'XDG_CONFIG_HOME',
]

class MemorySettings extends SettingsProvider {
  raw = {}

  get writable() {
    return true
  }

  async load() {
    return structuredClone(this.raw)
  }

  async persist(namespace, section) {
    this.raw[namespace] = structuredClone(section)
  }
}

// Message ids are minted fresh on every run; redact them so the golden snapshot stays deterministic.
function stableEvent(event) {
  const data = structuredClone(event.data)
  if (data?.message?.id !== undefined) data.message.id = '<message-id>'
  return { type: event.type, data }
}

function systemText(events) {
  const found = events.find(event => event.type === 'system/message')
  if (found === undefined) throw new Error('assembled application omitted system/message')
  return found.data.message.content.map(block => block.type === 'text' ? block.text : '').join('')
}

async function snapshotValue(ctx, agent, assembly) {
  const session = agent.session
  const events = session.snapshotEvents()
  const ponytailSection = assembly.sections.find(section => section.name === 'ponytail:policy')
  if (ponytailSection === undefined) throw new Error('assembled application omitted ponytail:policy')
  const text = systemText(events)

  return {
    application: {
      loader: 'alpha.4',
      plugin: ctx.ponytail.name,
      skills: (await ctx.skills.list()).map(skill => skill.name),
    },
    settings: {
      defaultMode: ctx.ponytail.currentSettings().defaultMode,
      quietStartup: ctx.ponytail.currentSettings().quietStartup,
    },
    session: {
      state: ctx.ponytail.stateOf(session),
      events: events.map(stableEvent),
    },
    modelRequest: {
      sectionNames: assembly.sections.map(section => section.name),
      hasPonytailPolicy: text.includes(ponytailSection.text),
    },
  }
}

function eventsContainPonytail(session) {
  return session.snapshotEvents().some(event => event.type === 'ponytail/mode')
}

// The handle API intentionally hides artifact paths; the storage root is a fresh temp dir,
// so the single session generation log uniquely identifies the file under repair.
async function findSessionArtifact(storageRoot) {
  const found = []
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (/session\.v\d+\.jsonl(\.zstd)?$/.test(entry.name)) found.push(path)
    }
  }
  await visit(storageRoot)
  if (found.length !== 1) throw new Error(`expected one session artifact, found ${found.length}`)
  return found[0]
}

async function readSession(storageRoot, id) {
  const reader = new Context()
  try {
    await reader.plugin(SessionStore)
    await reader.plugin(JsonlSessionPersistence, { root: storageRoot, compression: 'none' })
    const handle = await reader.sessionPersistence.open(id, 'read')
    try {
      return (await handle.read()).events
    } finally {
      await handle.close()
    }
  } finally {
    await reader.fiber.dispose()
  }
}

async function main() {
  const previousEnvironment = Object.fromEntries(environmentNames.map(name => [name, process.env[name]]))
  for (const name of environmentNames) delete process.env[name]
  const configRoot = await mkdtemp(join(tmpdir(), 'dsh-ponytail-snapshot-'))
  process.env.XDG_CONFIG_HOME = configRoot

  const ctx = new Context()
  try {
    for (const [plugin, config] of [
      [SessionStore],
      [SessionProjectionRegistry],
      [AgentRegistry],
      [CommandRuntime],
      [SkillRegistry],
      [SystemPrompt, {}],
      [MemorySettings],
      [Loader],
    ]) await ctx.plugin(plugin, config)

    const pluginUrl = pathToFileURL(join(root, 'lib/index.js')).href
    await ctx.loader.create({ id: 'ponytail', name: pluginUrl })
    const session = ctx.sessions.create('snapshot-session')
    const agent = { id: session.id, session, status: 'idle', ctx, options: {}, inbox: {} }
    ctx.agents.register(agent)
    ctx.emit('agent/session-start', { agent, source: 'startup' })
    const assembly = await ctx.systemPrompt.assemble(assembleContextFor(agent))
    // V3 envelope: request/header carries no system text; the rendered prompt is surface node 0.
    session.append('request/header', {
      header: { config: { provider: 'snapshot-provider', model: 'snapshot-model' } },
      reason: 'initial',
    })
    session.append('system/message', {
      turn: 1,
      step: 1,
      message: createSystemMessage(renderPrompt(assembly), '@deepseek-ai/dsh-system-prompt'),
    }, { surfaceOp: 'append' })
    assert.equal(eventsContainPonytail(session), false)
    const storageRoot = join(configRoot, 'sessions')
    const writer = new Context()
    await writer.plugin(SessionStore)
    await writer.plugin(JsonlSessionPersistence, { root: storageRoot, compression: 'none' })
    const writeHandle = await writer.sessionPersistence.create(session.header)
    await writeHandle.append(session.snapshotEvents())
    await writeHandle.flush()
    await writeHandle.close()
    const path = await findSessionArtifact(storageRoot)
    await writer.fiber.dispose()

    // A fresh Host has never loaded Ponytail or changed its event catalog.
    const restored = await readSession(storageRoot, session.id)
    assert.deepEqual(restored, session.snapshotEvents())
    const original = await readFile(path, 'utf8')
    const legacy = { type: 'ponytail/mode', seq: session.snapshotEvents().length, time: Date.now(), data: { mode: 'full', pending: null, source: 'default', inheritedFrom: null } }
    await writeFile(path, original + JSON.stringify(legacy) + '\n')
    await assert.rejects(readSession(storageRoot, session.id), /unknown to this harness/)
    await repairFile(path, true)
    const repaired = await readSession(storageRoot, session.id)
    assert.equal(repaired.at(-1).ignorable, true)
    assert.deepEqual(repaired.slice(0, -1), session.snapshotEvents())
    console.log('uninstall smoke passed: fresh Host reads new logs and repaired legacy logs without Ponytail')
    const actual = await snapshotValue(ctx, agent, assembly)
    const serialized = `${JSON.stringify(actual, null, 2)}\n`

    if (process.env.DSH_SNAPSHOT === 'record') {
      await mkdir(join(root, 'snapshots'), { recursive: true })
      await writeFile(snapshotPath, serialized, 'utf8')
      console.log(`snapshot recorded: ${snapshotPath}`)
    } else {
      const expected = await readFile(snapshotPath, 'utf8')
      assert.equal(serialized, expected, `keyless assembled application snapshot differs: ${snapshotPath}`)
      console.log('snapshot smoke passed: alpha.4 assembled Host transcript is stable')
    }
  } finally {
    await ctx.fiber.dispose()
    for (const name of environmentNames) {
      const value = previousEnvironment[name]
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    await rm(configRoot, { recursive: true, force: true })
  }
}

await main()
