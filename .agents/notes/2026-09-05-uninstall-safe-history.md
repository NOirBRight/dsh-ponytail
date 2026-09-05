# Uninstall-safe Ponytail history

Ponytail mode is optional once the plugin is absent: standard `request/header` events preserve the actual model system prompt. Required custom mode events make historical sessions depend on the plugin being installed, so the plugin must not add its name to the Host readonly event catalog.

Official Alpha.4 and rc.1 accept `ignorable: true` when reading but expose no such option in `Session.append()`. Until an official writer option is released, keep live mode state in a WeakMap, reset it on runtime restart, and leave live mode projections disabled. Do not mutate frozen events, replace Session methods, or patch Core. An upstream API proposal should add omission-safety metadata to custom-event append and test persistence reload without the writer plugin.

Legacy logs require explicit offline repair. Preserve all records and their sequence numbers; only mark `ponytail/mode` ignorable. Keep a byte-exact backup and preserve the separate Zstandard header frame used by directory discovery. Node 22 one-shot decompression reads only the first concatenated frame, so the repair tool uses the zstd CLI to decode every frame.

Verification: the assembled Host snapshot smoke writes with Ponytail and reads through a fresh persistence Host without it, rejects an unmarked legacy event, then accepts the repaired event. Raw and concatenated-Zstandard repair tests verify backup and idempotence. A copy of the reported production log was also inspected through official rc.1: 66,922 logical events remained readable without Ponytail after adding one marker; all 10,493 physical records were preserved.
