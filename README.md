# dsh-ponytail

`dsh-ponytail` is an independent DeepSeek Harness alpha.3 bundle that brings Ponytail's minimal-code policy, six skills, session modes, commands, subagent inheritance, and Web GUI settings to DSH. It does not modify or copy DeepSeek Harness Core.

## Install

```sh
DSH_HOME=~/.dsh-lab dsh plugin --profile web add link:/home/noirbright/Workstation/dsh-ponytail
```

For the first acceptance pass, install the link only in the `~/.dsh-lab` / port 3082 profile. Keep the production `~/.dsh` / port 3080 profile unchanged.

The bundle is built for `dsh-v0.1.2-alpha.3` and `@dietrichgebert/ponytail@4.9.0`. It ships the upstream skill content locally, so requests do not fetch the network.

## Modes and commands

Each session records a complete `ponytail/mode` event and exposes a `ponytail` projection containing `mode` and `pending`. The four modes are `off`, `lite`, `full` (default), and `ultra`.

```text
/ponytail                 show current mode
/ponytail status          show current and pending mode
/ponytail lite|full|ultra|off
/ponytail default <mode> set the default for new sessions
```

Changing mode while a model turn is running is recorded as pending and takes effect at the next accepted step. `stop ponytail` and `normal mode` (whole-message, case-insensitive, trailing punctuation ignored) turn the current session off.

The six bundled skills are `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, and `ponytail-help`. The DSH Skill Registry owns discovery and invocation; the upstream MCP is not duplicated.

## Settings and GUI

The Host namespace is `ponytail`:

- `defaultMode`: `full`
- `hideStatus`: `false`
- `quietStartup`: `false`
- `subagentMatcher`: empty (all subagents)

Resolution order is `PONYTAIL_*` environment variables, DSH Settings, the optional upstream `~/.config/ponytail/config.json`, then defaults. `subagentMatcher` is case-insensitive and unanchored against DSH `agentPreset`; a missing preset inherits. Invalid regular expressions fail when the plugin loads or the setting is saved.

When the DSH Web settings surface includes Plugins, the Ponytail card is collapsed by default and expands from its summary row into a responsive Focus sheet for `defaultMode`, `quietStartup`, and `subagentMatcher`. It responds to its own available width: narrow layouts use two mode columns, stack the actions, and keep 44px touch targets for the dsh-mobile settings drawer. The composer has no Ponytail-specific control; use `/ponytail <mode>` for an in-session change. `hideStatus` remains readable and writable for old configuration files but no longer controls browser UI.

The startup notice is rendered through DSH's `shell.overlay` slot, shared by the desktop frame and dsh-mobile. `quietStartup` hides only this notice; it does not change modes, commands, or system-prompt injection.

## Development

```sh
pnpm install
pnpm run check
```

`pnpm run check` runs unit tests, typecheck, Host/Web builds, alpha.3 Host/client loader smokes, and pack/install checks. `scripts/sync-upstream.mjs` updates only the copied SKILL.md files from a local upstream checkout.

See [README.zh.md](README.zh.md) for the Chinese guide and [UPSTREAM.md](UPSTREAM.md) for pinned provenance.
See [DESIGN.md](DESIGN.md) for the architecture and synchronization boundaries.
