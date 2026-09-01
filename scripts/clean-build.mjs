import { rm } from 'node:fs/promises'

// `tsc` does not remove declarations for source files deleted between builds.
// The output directory is generated exclusively by this package's build.
await rm('lib', { recursive: true, force: true })
