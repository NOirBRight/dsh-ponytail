import { strict as assert } from 'node:assert'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { Loader } from '@deepseek-ai/cordis-plugin-loader'
import { AgentRegistry, assembleContextFor } from '@deepseek-ai/dsh-agent'
import { CommandRuntime } from '@deepseek-ai/dsh-commands'
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

async function snapshotValue(ctx, agent, assembly) {
  const session = agent.session
  const events = session.snapshotEvents()
  const ponytailSection = assembly.sections.find(section => section.name === 'ponytail:policy')
  if (ponytailSection === undefined) throw new Error('assembled application omitted ponytail:policy')
  const header = events.find(event => event.type === 'request/header')
  if (header === undefined || header.data.header.system === undefined) throw new Error('assembled application omitted the Ponytail request header')

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
      events: events.map(event => ({ type: event.type, data: event.data })),
    },
    modelRequest: {
      sectionNames: assembly.sections.map(section => section.name),
      hasPonytailPolicy: header.data.header.system.includes(ponytailSection.text),
    },
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
    session.append('request/header', {
      header: {
        config: { provider: 'snapshot-provider', model: 'snapshot-model' },
        system: renderPrompt(assembly),
      },
      reason: 'initial',
    })
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
