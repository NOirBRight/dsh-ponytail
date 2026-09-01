import { strict as assert } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const bootstrapCode = await readFile(resolve('node_modules/@deepseek-ai/dsh-client-modules/lib/client.js'), 'utf8')
const code = await readFile(resolve('lib/client.js'), 'utf8')
const pendingQueue = []
const target = {
  mode: 'queue',
  pendingQueue,
  load(registration) {
    pendingQueue.push(registration)
  },
}
const browserWindow = { __ModuleLoader__: target }

// Evaluate both browser artifacts through alpha.3's registration facade. The
// bootstrap factory then constructs alpha.3's real client module system.
const evaluate = (source) => new Function('window', source)(browserWindow)
evaluate(bootstrapCode)
evaluate(code)

const bootstrapRegistration = pendingQueue.shift()
assert.equal(bootstrapRegistration?.id, '@deepseek-ai/dsh-client-modules')
const registration = pendingQueue[0]
assert.equal(registration.id, 'dsh-ponytail')

const staticModules = {
  react: await import('react'),
  'react/jsx-runtime': await import('react/jsx-runtime'),
}
const bootstrapExports = bootstrapRegistration.factory(() => {
  throw new Error('client bootstrap unexpectedly requested an external module')
})
const system = bootstrapExports.createClientModuleSystem(target, {
  id: bootstrapRegistration.id,
  exports: bootstrapExports,
}, {
  boot: {
    rev: 'client-loader-smoke',
    entries: [{
      id: 'dsh-ponytail',
      url: 'about:blank?rev=client-loader-smoke',
      rev: 'client-loader-smoke',
      inject: [],
      external: ['react', 'react/jsx-runtime'],
    }],
    batches: [{ phase: 'application', url: 'about:blank?rev=client-loader-smoke', rev: 'client-loader-smoke', entries: ['dsh-ponytail'] }],
  },
  staticModules,
})

const exports = await system.import('dsh-ponytail')
assert.equal(typeof exports.apply, 'function')
assert.deepEqual(exports.inject, ['slots', 'locale', 'settingsScope', 'sessions'])
console.log('client loader smoke passed: alpha.3 materialized the built browser face')
