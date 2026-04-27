---
name: releases-and-changesets
description: Author changesets and prepare releases under the fixed (lockstep) versioning policy. Use whenever creating a `.changeset/*.md`, scoping a release, choosing a bump level, running `bun run version` / `bun run release` / `bun run release:with-version`, or adding a new publishable package. Trigger on cues like "changeset", "release", "publish", "version bump", "patch", "minor", "major", "fixed versioning", "lockstep".
---

# Releases and Changesets (Fixed / Lockstep Versioning)

Canonical rule: [`.cursor/rules/release-version-alignment.mdc`](../../../.cursor/rules/release-version-alignment.mdc).
Lockstep package list (source of truth):
[`.changeset/config.json`](../../../.changeset/config.json) (the `fixed`
block).
Enforcement script:
[`scripts/check-fixed-versioning.mjs`](../../../scripts/check-fixed-versioning.mjs)
(runs as part of `bun run verify:publish`).
Consumer-facing docs:
[`docs/setup/publishing.md`](../../../docs/setup/publishing.md) and the
"Versioning Policy" section in [`README.md`](../../../README.md).

## Policy in one paragraph

All publishable `@pie-players/*` packages are released with a **fixed
(lockstep) version**. At any published version, every package in the suite
carries that same version number — there is no per-package version drift.
Every release bumps every publishable package, including ones whose source
did not change. That is **expected**, not a bug to fix.

## Authoring a changeset

When making changes that should ship in a release:

```bash
bun run changeset
```

Pick a bump level for the suite:

- **patch** — default. Bug fixes, additive non-breaking refactors,
  internal changes. Always safe.
- **minor** — only when the user explicitly asks for one or the change
  introduces user-visible additive surface. Bumps every publishable
  package to the next minor.
- **major** — only when the user explicitly asks. A breaking change in
  any single publishable package forces a major bump on **every**
  publishable package in the same release. Factor that in; prefer
  additive changes where feasible.

The changeset must scope to the publishable packages affected. When in
doubt about the impact set, **default to all publishable packages** —
the lockstep policy means there is no value in narrowing.

## When to add a changeset

- Any change that ships in `dist` (source edits in publishable packages,
  CE registration changes, contract updates).
- New publishable package — see the "Adding a publishable package"
  section below.
- Skip for: docs-only changes that do not ship to npm, CI/lefthook tweaks,
  changes confined to `apps/*` or `tools/*` (those are not publishable),
  pure dev-script edits.

## Release commands

| Command | What it does |
| --- | --- |
| `bun run changeset` | Interactive: author a `.changeset/<name>.md`. |
| `bun run version` | Apply pending changesets to package versions. |
| `bun run verify:publish` | Full pre-publish gate (build + every `check:*`). |
| `bun run release` | Publish wrapper: rewrites workspace ranges, runs `changeset publish`, restores ranges. |
| `bun run release:with-version` | Manual patch-only path: temp all-packages patch changeset → preflight → publish. Mirrors CI. |
| `bun run release:label` / `release:label:push` | Tag a coordinated release wave (annotated tag, default `pie-players-YYYY.MM.DD`). |

## Adding a publishable package

When adding a new package under `packages/*` that ships to npm:

- Add it to the `fixed` block in
  [`.changeset/config.json`](../../../.changeset/config.json) **in the same
  change set** that introduces the package. A publishable package
  outside the `fixed` block silently breaks the lockstep invariant.
- Run `bun run check:fixed-versioning` (also part of `verify:publish`) to
  confirm.

## Do not

- Prepare release bumps for only a subset of changed packages. "Only
  package X changed, so only bump X" is the wrong framing for this repo.
- Remove packages from the `fixed` block to "unblock" a release. That
  hides drift. Escalate to the maintainer instead.
- Run `npm publish` directly. Use `bun run release` /
  `bun run release:with-version` so workspace ranges and token auth are
  handled consistently.

## Pre-publish smoke (recommended before pushing a release branch)

```bash
bun run verify:publish
```

This runs build + `check:fixed-versioning`, `check:package-metadata`,
`check:custom-elements`, `check:ce-define-safety`, `check:publint`,
`check:types-publish`, `check:pack-exports`, `check:pack-smoke`,
`check:deps`, `check:source-exports`, `check:consumer-boundaries`,
`check:ce-consumer-contract`, `check:runtime-compat`,
`check:node-consumer-imports`, `check:bundle-safety`,
`check:math-rendering-version`, `check:engine-core-purity`.

## Related skills

- `code-review-workflow` — release prep usually warrants a review pass.
- `playwright-sandbox` — `bun run release:with-version` runs `bun run test`
  which can trigger Playwright; invoke with `required_permissions: ["all"]`.
