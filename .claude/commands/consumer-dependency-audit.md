---
description: Refresh the consumer dependency pad, or check one surface against it.
argument-hint: [consumer-label | surface | "add <shape>"]
---

# Consumer Dependency Audit Command

Run the `consumer-dependency-audit` skill now, which follows
[`docs/integrations/consumer-api-dependencies-maintenance.md`](../../docs/integrations/consumer-api-dependencies-maintenance.md).

Scope from `$ARGUMENTS`:

- **Empty** — full refresh. Resolve every consumer label, re-derive each one,
  rewrite the pad, advance the verified date.
- **A consumer label** (`Host V`, `Host A`, `Host R`) — re-derive that consumer
  only. Leave the other rows and their verification dates alone, and do not
  advance the pad's date.
- **A surface** (a tag, attribute, event, export path, token, or method name) —
  answer *who consumes this, and does it break silently?* from the pad plus a
  targeted grep of the resolved checkouts. Report the answer; only edit the pad
  if the check contradicts a row.
- **`add <integration shape>`** — add a consumer. Ask for its checkout path,
  derive its surface from scratch, give it the next free label, and record the
  label-to-path mapping in `.claude/consumer-checkouts.local.json` only.

Resolve checkout paths through the local map first and ask the developer for any
that are still missing, per the skill's Step 1 — never audit a silent subset.

The pad is public and the consumers are not: no repository names, product names,
ticket keys, endpoints, host config keys, or quoted host code reach
`docs/`.
