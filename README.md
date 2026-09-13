# dsh-ponytail

`dsh-ponytail` is an independent DeepSeek Harness bundle that brings Ponytail's minimal-code policy, six skills, session modes, commands, subagent inheritance, and Web GUI settings to DSH. It does not modify or copy DeepSeek Harness Core.

## Compatibility

Host `@deepseek-ai/dsh-*` packages are not version-locked: peers are `*` and optional. `devDependencies` pin the compile target (`0.1.5-rc.1`). Cordis stays `>=4.0.2 <5.0.0`.

Verified Hosts in `package.json#dsh.compatibility.dshReleases` are evidence, not an allowlist. Unknown newer Hosts warn once and keep the normal mount path. Only a reproduced failure is blocklisted.

## Install

Latest:

```sh
dsh plugin --profile web add --force https://github.com/NOirBRight/dsh-ponytail/releases/latest/download/dsh-ponytail-0.2.6.tgz
```

Fixed GitHub release:

```sh
dsh plugin --profile web add --force https://github.com/NOirBRight/dsh-ponytail/releases/download/v0.2.6/dsh-ponytail-0.2.6.tgz
```

Lab checkout for local acceptance:

```sh
DSH_HOME=~/.dsh-rc1-canary dsh plugin --profile web add link:/home/noirbright/Workstation/dsh-ponytail
```

For the first acceptance pass, install the link only in the `~/.dsh-rc1-canary` / port 3082 profile. Keep the production `~/.dsh` / port 3080 profile unchanged.

The bundle is built for `dsh-v0.1.5-rc.1` and `@dietrichgebert/ponytail@4.9.0`. It ships the upstream skill content locally, so requests do not fetch the network.

The repository, release package, and plugin brand are all `dsh-ponytail`. Distribution is GitHub release only: the unscoped `dsh-ponytail` npm name is owned by another publisher, so `npm publish` stays disabled (no `NPM_TOKEN`).

## Modes and commands

Mode and pending selections are kept in memory for the live session. Restarting the Host or reloading the plugin resets them to the configured default. No custom session events are written, so uninstalling Ponytail does not prevent history loading. The four modes are `off`, `lite`, `full` (default), and `ultra`.

```text
/ponytail                 show current mode
/ponytail status          show current and pending mode
/ponytail lite|full|ultra|off
/ponytail default <mode> set the default for new sessions
```

Changing mode while a model turn is running is recorded as pending and takes effect at the next accepted step. `stop ponytail` and `normal mode` (whole-message, case-insensitive, trailing punctuation ignored) turn the current session off.

The six bundled skills are `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, and `ponytail-help`. The base `ponytail` skill remains user-invocable but is removed from the model catalog—even if another provider installed a global copy—because the active mode already injects the same policy through the system prompt. The DSH Skill Registry owns discovery and invocation; the upstream MCP is not duplicated.

## Settings and GUI

The Host namespace is `ponytail`:

- `defaultMode`: `full`
- `hideStatus`: `false`
- `quietStartup`: `true` (startup notice hidden by default; advanced configuration, hidden from the settings card)
- `subagentMatcher`: empty (all subagents; advanced configuration, hidden from the settings card)

Resolution order is `PONYTAIL_*` environment variables, DSH Settings, the optional upstream `~/.config/ponytail/config.json`, then defaults. Subagents inherit their parent session mode by default; advanced deployments can still scope inheritance with `PONYTAIL_SUBAGENT_MATCHER` or `subagentMatcher` in the config file. Matching is case-insensitive and unanchored against DSH `agentPreset`; a missing preset inherits. Invalid regular expressions fail when the plugin loads or the setting is saved.

When the DSH Web settings surface includes Plugins, the Ponytail card is collapsed by default and expands from its summary row into a responsive settings sheet for `defaultMode`. The optional startup notice is unavailable on current runtimes, subagent inheritance remains automatic, and the optional matcher is kept out of the card to keep the common path focused. It responds to its own available width: narrow layouts use two mode columns, stack the actions, and keep 44px touch targets for the dsh-mobile settings drawer. The composer has no Ponytail-specific control; use `/ponytail <mode>` for an in-session change. `hideStatus` remains readable and writable for old configuration files but no longer controls browser UI.

The optional startup notice is unavailable while live mode projections are disabled. `quietStartup` remains a compatibility setting.

## Development

```sh
pnpm install
pnpm run check
```

`pnpm run check` runs unit tests, typecheck, Host/Web builds, 0.1.5-rc.1 Host/client loader smokes, and pack/install checks. `scripts/sync-upstream.mjs` updates only the copied SKILL.md files from a local upstream checkout.

The check also compares the keyless assembled Host transcript in `snapshots/ponytail-host.json`; after reviewing an intentional runtime change, refresh it with `pnpm run snapshot:record`.

See [README.zh.md](README.zh.md) for the Chinese guide and [UPSTREAM.md](UPSTREAM.md) for pinned provenance.
See [DESIGN.md](DESIGN.md) for the architecture and synchronization boundaries.

## Repairing older sessions

Compressed repair requires the `zstd` executable on PATH. Logs written by 0.2.4 and earlier need a separate repair; upgrading does not rewrite history. Test a copy first and stop the owning Host before applying to the original. The default is a dry run. `--apply` preserves the original bytes in an exclusive `.before-ponytail-repair` backup and only marks Ponytail mode events ignorable. For rollback, stop the Host and restore the backup over the original file.

```sh
node scripts/repair-session.mjs /path/to/session.jsonl.zstd
node scripts/repair-session.mjs --apply /path/to/session.jsonl.zstd
```
