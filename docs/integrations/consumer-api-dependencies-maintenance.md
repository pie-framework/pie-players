# Maintaining the consumer dependency pad

How to refresh [`consumer-api-dependencies.md`](./consumer-api-dependencies.md),
the record of which `@pie-players` surfaces downstream host applications touch
and which of those break silently.

This file is the authority on the procedure, for any agent harness or for a
person doing it by hand. Claude Code additionally ships
[`.claude/skills/consumer-dependency-audit/SKILL.md`](../../.claude/skills/consumer-dependency-audit/SKILL.md)
and a `/consumer-dependency-audit` command, which trigger on their own and then
follow this file — they add discovery, not rules. Other harnesses reach this
through [`AGENTS.md`](../../AGENTS.md).

The pad exists to answer one question — *if I change this, who breaks?* — so
every edit either sharpens that answer or comes out.

## Enforcement

`bun run check:consumer-pad` compares the branch against its merge-base with
`origin/develop` and fails when a surface-defining file changed and the pad did
not. It runs inside `verify:ci-lint-typecheck`, so it reaches the full local PR
gate and CI regardless of which agent harness — or none — produced the change.

Its trigger list in [`scripts/check-consumer-pad.mjs`](../../scripts/check-consumer-pad.mjs)
is hand-curated from the pad's own risk groups, not a glob. That is deliberate:
a gate that fires on everything trains people to reach for the override. When a
refresh adds a row that a real change would have slipped past, widen the trigger
list in the same change.

Satisfy the gate by updating the pad. When a surface moved but every row still
reads true, say so in a commit message trailer — `Consumer-pad: rows unchanged,
<what you checked>` — rather than editing the verified date to make the diff
appear.

## Redaction rule

This repository is public. The consumers are internal. The pad therefore
identifies them by integration shape only, and nothing else.

Never write into the pad, or anywhere else in `docs/`:

- Repository, product, service, customer, tenant, or team names
- Ticket keys or issue URLs
- Hostnames, endpoints, bucket names, or CDN origins belonging to a consumer
- A consumer's own config key names, environment variable names, or feature
  flag names
- Quoted or paraphrased consumer source code

Do write: the `@pie-players` specifier, tag, attribute, property, event,
method, config key, token, or `dist` filename being consumed; how it is
consumed; and what breaks if it changes. Those are all facts about *this*
repository's surface.

When a finding can only be stated by naming something on the forbidden list,
state the shape instead: "the host maps four `TTSErrorCode` members onto HTTP
statuses" rather than the route, the service, or the ticket.

## Step 1 — Locate the consumer checkouts

Resolve every label in the pad to a path on this machine, in this order. Stop
at the first that works for a given label.

1. **The local map.** Read `.claude/consumer-checkouts.local.json`, which is
   gitignored and is the only place the mapping is recorded. Shape:

   ```json
   {
     "$comment": ["why this file is gitignored, and any non-consumers to skip"],
     "Host V": "/absolute/path/to/checkout",
     "Host A": "/absolute/path/to/checkout",
     "Host R": "/absolute/path/to/checkout/containers/<app>"
   }
   ```

   A label may map to a subdirectory when the consumer is one app inside a
   larger repository — point it at the directory holding the `package.json`
   that carries the `@pie-players` dependencies, not at the repository root.
   Verify each path exists and contains a `package.json` before trusting it.

   Read `$comment` too: it records why the file is not committed, and which
   nearby repositories are deliberately *not* consumers.

2. **Probe.** Look for sibling checkouts near this repository's parent, and one
   level up from that. Match on a `package.json` that depends on any
   `@pie-players/*` package. Do not guess from directory names alone.

3. **Ask the developer.** For every label still unresolved, ask — do not skip
   the consumer, and do not silently audit a subset.

   Make the question answerable without knowing this file exists: say which
   consumer is meant in terms of its integration shape ("the Angular fixed-form
   delivery host"), say that an absolute path to the checkout is wanted, and
   offer *skip this consumer for now* so a developer without that checkout can
   still refresh the rest. Ask for every missing label in one round rather than
   serially.

After asking, offer to write the answers into
`.claude/consumer-checkouts.local.json` so the next run does not ask again.
Create the file if absent. Never add it to git, and never echo a resolved path
into the pad, a changeset, a commit message, or a PR description.

If a consumer is skipped, say so in the summary and leave its rows in the pad
untouched with their existing verification date. Do not delete rows you could
not check, and do not advance the pad's "last verified" date unless every
non-skipped consumer was re-derived.

## Step 2 — Re-derive the surface

Per consumer checkout, excluding `node_modules`, lockfiles, and build output:

1. `grep -rn "@pie-players" <checkout>` — the entrypoint set and the version
   range. Record whether the range is exact or a caret; a caret means every
   published patch reaches that host without a code change on its side.
2. Extract **named imports per specifier**, not just the specifier list. A
   specifier-only inventory hides module API usage entirely, which is the
   deepest coupling any consumer has. Walk `.ts`, `.tsx`, `.svelte`, `.vue`,
   and `.js`.
3. Grep for `pie-` tag names in templates and markup, `--pie-` custom
   properties in styles, and `::ng-deep` / `:deep(` / `:global(` / `@scope`
   blocks. Style rules that reach into player DOM are API even when no import
   names them.
4. Grep for bare `import '@pie-players/...'` side-effect imports. A package
   consumed this way is being relied on to register something at import time.
5. Read the component that mounts the player end to end. Coordinator,
   controller, `runtime`, and `hooks` usage concentrates there and does not
   grep well. Note which properties are set as attributes versus as properties,
   and which values are strings versus booleans — the two differ and both must
   keep working.
6. Note direct `node_modules/@pie-players/**` paths in build configs and
   hard-coded CDN paths. Those bypass the `exports` map, so the `dist`
   filenames themselves become API.

## Step 3 — Verify against this repository

For every surface a consumer claims to use, confirm it exists here before
recording it. Several rows in the pad exist only because a grep came back
empty, and those are the most valuable rows in the file.

Verify against a **mainline ref**, not just the installed package:

```sh
git show origin/develop:packages/<pkg>/package.json
```

Published packages and mainline have already diverged once — a release cut from
a feature branch shipped a `pie-theme` export that existed on no mainline ref,
so the next release from `develop` would have removed it. When the installed
package has a surface that `origin/develop` does not, that is a release
regression waiting to happen: report it as the headline finding, not as a row.

Also check the reverse direction. A consumer that sets a CSS custom property or
subscribes to an event name that does not exist here is running dead code;
record it under the consumer-side defects section rather than as a dependency.

## Step 4 — Rewrite the pad

Keep the existing section order. Within it:

- Group the change-risk lists by **who breaks**, never by how hard the change
  is. A surface only the internally-controlled consumer touches is not a
  constraint: it says *change freely, land that consumer's fix in the same
  push*. Never narrow a design to spare it.
- Put a surface in the silent-breakage group only when a client-facing consumer
  touches it **and** the failure produces no build error and no runtime error
  there. Type errors and module-resolution failures belong in the lower-risk
  group.
- State the invariant, not the incident. "The invariant to preserve is
  pass-through" beats a narrative about how it was discovered.
- Delete rows you could not confirm. A stale row is worse than a missing one,
  because it gets trusted.
- Update the "last verified" date, and the version range recorded per consumer.

Follow the documentation voice used elsewhere in `docs/`: state the decision
then the constraint that forced it, headings as noun phrases, no
reader-coaching, no narrated incidents.

## Step 5 — Report

Summarize to the developer, not in the pad:

- Which consumers were re-derived, and which were skipped and why
- Rows added, changed, and deleted
- Any release regression found in Step 3, first and plainly
- Any consumer-side dead code found

Do not commit unless asked. If the audit found a release regression, say what
has to merge before the next release rather than merging it unprompted.
