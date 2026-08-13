---
name: consumer-dependency-audit
description: Refresh docs/integrations/consumer-api-dependencies.md by re-deriving which @pie-players surfaces downstream host applications actually consume, and re-grouping the change-risk lists. Use when asked to update, refresh, verify, or extend the consumer dependency pad, when adding a consumer to it, when checking whether a proposed public-surface change would break a client, or before cutting a release that touches a public surface. Trigger on cues like "consumer dependencies", "dependency pad", "who consumes this", "will this break clients", "downstream hosts", "consumer api surface".
---

# Consumer Dependency Audit

Follow
[`docs/integrations/consumer-api-dependencies-maintenance.md`](../../../docs/integrations/consumer-api-dependencies-maintenance.md)
end to end. It is the authority on the redaction rule, checkout resolution,
extraction, verification, the rewrite rules, and reporting — for every harness,
not just this one. Read it before touching
[`docs/integrations/consumer-api-dependencies.md`](../../../docs/integrations/consumer-api-dependencies.md).

Do not restate that procedure here and do not diverge from it. If the procedure
itself needs to change, change it there.

## What this skill adds

Trigger coverage, so the audit happens without being asked for by name, and the
Claude-side mechanics for two of its steps.

**Step 1, asking for checkouts.** Use `AskUserQuestion`, one question per
unresolved label, all in a single call so the developer answers them together.
Phrase each by integration shape rather than by label, and include a
*Skip this consumer for now* option — `AskUserQuestion` always offers *Other*,
which is where a path gets typed. Write accepted answers into
`.claude/consumer-checkouts.local.json` with `Write`; never `git add` it.

**Step 2, extraction.** Prefer `Grep` and `Read` over shell pipelines for the
repository sweeps, and note that a named-import inventory across `.svelte` and
`.vue` files needs a real parse rather than a line-oriented grep — a short
throwaway script in the scratchpad directory is the cheapest way to get one.

When a surface check is the whole request ("does anything consume
`--pie-button-bg`?"), answer from the pad plus one targeted grep and stop. A
full re-derivation is for a refresh, not for a lookup.
