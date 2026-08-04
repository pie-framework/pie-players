---
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
---

Key the instrumentation debugger list on a panel-assigned record key so colliding record ids can no longer freeze the panel.

The panel keyed its `{#each}` on `record.id`. Ids are assigned by whoever emitted
the record, and the panel reads an open `pie-instrumentation-debug-record` window
event that hosts, demo pages and tests dispatch into directly with hand-written
ids — those repeat the ids `emitInstrumentationDebugRecord` hands out from its own
counter, and a synthetic record can arrive with no id at all.

A repeat threw Svelte's `each_key_duplicate`. Because the throw happens during
reconciliation, the failure was worse than a logged error: the list stopped
updating for the rest of the session, so the colliding record and every record
after it were silently dropped while the panel kept displaying its stale rows. The
existing e2e coverage passed straight through it — it asserted that a row was
visible, which was already true before the record was dispatched.

Each record now gets a monotonic per-panel key on ingest, unique for the panel's
lifetime including across `clear`, and the list keys and row selection use it
instead of `id`. Two records that share an id render as two rows, and selecting one
highlights only that row. Timestamp ties now break on ingest order rather than
`id`, so an injected record's arbitrary id cannot reorder the list, and a record
with an unrecognised `kind` is bounded by the global cap instead of escaping the
per-kind caps.

The list logic moves to `panel-records.ts` (internal to the package; no export
surface change) and is covered by unit tests plus an e2e regression test that
drives the panel with two records sharing an id.
