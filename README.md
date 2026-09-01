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
- `quietStartup`: `true` (startup notice hidden by default; advanced configuration, hidden from the settings card)
- `subagentMatcher`: empty (all subagents; advanced configuration, hidden from the settings card)

Resolution order is `PONYTAIL_*` environment variables, DSH Settings, the optional upstream `~/.config/ponytail/config.json`, then defaults. Subagents inherit their parent session mode by default; advanced deployments can still scope inheritance with `PONYTAIL_SUBAGENT_MATCHER` or `subagentMatcher` in the config file. Matching is case-insensitive and unanchored against DSH `agentPreset`; a missing preset inherits. Invalid regular expressions fail when the plugin loads or the setting is saved.

When the DSH Web settings surface includes Plugins, the Ponytail card is collapsed by default and expands from its summary row into a responsive settings sheet for `defaultMode`. The startup notice is hidden by default, subagent inheritance remains automatic, and the optional matcher is kept out of the card to keep the common path focused. It responds to its own available width: narrow layouts use two mode columns, stack the actions, and keep 44px touch targets for the dsh-mobile settings drawer. The composer has no Ponytail-specific control; use `/ponytail <mode>` for an in-session change. `hideStatus` remains readable and writable for old configuration files but no longer controls browser UI.

The startup notice is rendered through DSH's `shell.overlay` slot, shared by the desktop frame and dsh-mobile. `quietStartup` defaults to hiding only this notice; set `PONYTAIL_QUIET_STARTUP=false` or the config-file value to show it. It does not change modes, commands, or system-prompt injection.

## Development

```sh
pnpm install
pnpm run check
```

`pnpm run check` runs unit tests, typecheck, Host/Web builds, alpha.3 Host/client loader smokes, and pack/install checks. `scripts/sync-upstream.mjs` updates only the copied SKILL.md files from a local upstream checkout.

The check also compares the keyless assembled Host transcript in `snapshots/ponytail-host.json`; after reviewing an intentional runtime change, refresh it with `pnpm run snapshot:record`.

See [README.zh.md](README.zh.md) for the Chinese guide and [UPSTREAM.md](UPSTREAM.md) for pinned provenance.
See [DESIGN.md](DESIGN.md) for the architecture and synchronization boundaries.
