# Agent Note: Ponytail settings keep the common surface focused

Status: implemented

English | [中文](2026-09-01-ponytail-settings-surface.zh.md)

## Problem

The Ponytail settings card exposed controls for startup notices and subagent matching even though the common DSH path should only choose the default mode. The extra controls made the plugin card larger and duplicated advanced compatibility configuration without changing the runtime contract.

## Decision

The plugin settings card exposes only `defaultMode`. The card remains collapsed until the user expands it, and the same responsive sheet is used by desktop and mobile settings surfaces.

`quietStartup` remains part of the Host settings schema and all configuration layers for compatibility, but its default is `true` and it is not shown in the card. `subagentMatcher` likewise remains readable and writable through environment or upstream configuration so existing deployments keep their inheritance policy. The Host still records mode events, applies parent inheritance, and renders the startup overlay when an advanced configuration explicitly disables quiet startup.

The assembled Host snapshot is the keyless release check for the default settings, session event, registered skills, and model-facing Ponytail policy.

## Alternatives considered

**Keep all controls in the card.** Rejected because startup notices are hidden by default and subagent matching is an advanced compatibility option; presenting both in the common path obscures the only setting most users need.

**Remove the compatibility fields from the schema.** Rejected because existing upstream configuration and environment variables must continue to resolve without migration or silent loss.

**Add a second desktop-only settings surface.** Rejected because the DSH settings slot already provides the shared responsive surface used by dsh-mobile.

## Consequences

The default settings flow is smaller and consistent across desktop and mobile. Advanced users retain the old configuration paths, while the keyless assembled snapshot detects changes to the default and the model-visible policy before release.
