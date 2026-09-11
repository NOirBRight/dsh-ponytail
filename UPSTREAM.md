# Upstream provenance

This plugin carries the six files from `DietrichGebert/ponytail` version `4.9.0` at commit `2ed6c52c9d7e5e56942508591085fd45dea277d3`.

The upstream skills are copied into `skills/` so an installed DSH bundle has no runtime network dependency. Host hooks, statusline scripts, uninstall scripts, and Ponytail MCP are intentionally represented by DSH's session log, projection, dynamic system prompt, Commands, Skill Registry, and browser slots.

To update the copied skills in a development checkout, set `PONYTAIL_SOURCE` to a checked-out upstream repository and run `node scripts/sync-upstream.mjs`. Review the resulting skill-content diff and run the complete check before opening a dependency-update PR.

The current verified DSH compatibility target is `dsh-v0.1.5-rc.1` at commit
`183f08e9c6dde7e36cd2318eaee70b0da08fb35e`. Historical evidence also covers
`dsh-v0.1.2-alpha.4` at commit `4e84901e6471b79ec0338099867ebb4606d12bb5`
and `dsh-v0.1.2-rc.1`.

Official Alpha.4 / 0.1.2-rc.1 / 0.1.5-rc.1 can read ignorable external events
but cannot append that marker through the public Session API. Until an
official writer option is available, this plugin keeps mode selections in
memory and emits no custom session events. It does not mutate the Host event
catalog. On 0.1.5-rc.1 the assembled persona / policy text is recorded in
`system/message` (V3 envelope); `request/header` no longer carries system
prompt body. Snapshot repair smokes locate the single temp-tree session
artifact with `findSessionArtifact` because the persistence handle hides
paths — a test seam, not a Host API. Historical Alpha.2 logs remain isolated
and are not resumed by current runtimes.

Pinned SHA-256 values for the copied skills:

```text
skills/ponytail-audit/SKILL.md  5560b8e383dbe2ddfddc873a1e2bf2e586e23e0cd7d995537482b2315331f6d1
skills/ponytail-debt/SKILL.md   c84fba75f0ca12bfe83f9a78ea02fd125c5dd3f1fbb18124105a489937f284e6
skills/ponytail-gain/SKILL.md   24e01d1c9715cb136ba1c4f1e52a95940c0193558b876828e537736480d6408b
skills/ponytail-help/SKILL.md   2264d1615117b02b0fd5a69ec84cd2757006471a78e4d6c22eed6d581c1d37a4
skills/ponytail-review/SKILL.md 40df33b58fc6ef889b93585733feb9566b76e9586efa7f376785c1e995197ac0
skills/ponytail/SKILL.md        1316a2f3f95741d2300b116fe0c2d81ce4a9568656ed0a62643f54aaf09957f2
```
