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
did not change. That is **expected**, not a bug to fix. While we are pre-1.0
(the current `0.x.y` line), every release is a **`patch`** bump, even for
breaking changes — see "Bump level" below.

## Bump level — patch only

Until the maintainer rewrites the rule, **every release is `patch`**.
Pre-1.0 semver allows breaking changes within a `0.x` line, and the
lockstep invariant already keeps consumers aligned.

- Author every changeset entry as `patch`. Do not propose `minor` /
  `major` unless the maintainer explicitly lifts this constraint and
  updates
  [`.cursor/rules/release-version-alignment.mdc`](../../../.cursor/rules/release-version-alignment.mdc).
- A pending changeset declaring `minor` / `major` is a release blocker —
  flip it to `patch` before running `bun run release:with-version`. The
  auto-generated temporary all-packages changeset is always `patch`; the
  highest-declared bump in `.changeset/` wins for the lockstep set, so a
  stray `major` upgrades the whole suite.
- Document breaking changes in the changeset body (so consumers see them
  in the assembled `CHANGELOG.md`), but ship them under a `patch` bump.

## Authoring a changeset

When making changes that should ship in a release:

```bash
bun run changeset
```

Use `patch` for every entry. The changeset must scope to the publishable
packages whose source actually changed (the lockstep coverage for the
rest is added automatically by `release:with-version`). When in doubt
about which packages to list, **default to all publishable packages** —
the result is the same either way under lockstep.

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
| `bun run release:with-version` | **Canonical local-publish command.** Auto-generates a temporary all-packages patch changeset (lockstep coverage), runs `version`, restores workspace ranges, runs `check:npm-auth` + `verify:publish` + the workspace test suite, publishes via `release`, restores ranges again. Mirrors the CI release path. |
| `bun run release` | Publish wrapper invoked by `release:with-version` and CI: builds the publishable packages, runs `changeset publish` with workspace ranges resolved, then publishes the preloaded-player bundles. Don't run directly — use `release:with-version`. |
| `bun run release:label` / `release:label:push` | Tag a coordinated release wave (annotated tag, default `pie-players-YYYY.MM.DD`). |

## Local publishing

`bun run release:with-version` is the canonical command. To run it locally
you need:

- **NPM auth in `.env`.** The `release` step is wrapped in
  `dotenvx run -f .env`, and `check:npm-auth` (the first preflight step)
  also loads `.env` via `dotenvx`. The repo's `.env` contains the
  `NPM_TOKEN` for `@pie-players` publish access; no separate
  `npm login` is needed.
- **A clean working tree on the branch you're releasing from** (typically
  `master` after merge). The script writes to `package.json` and
  `CHANGELOG.md` files during `version`.
- **Outside the sandbox.** The command runs `bun run test`, which
  triggers Playwright and other browser-bound suites; invoke with
  `required_permissions: ["all"]`.

Bump-level note: the auto-generated temporary changeset only adds
**patch**-level entries for every publishable package, but if a regular
`.changeset/*.md` already declares a higher bump (`minor` / `major`) for
some package, the highest declared bump wins for the whole lockstep set.
When you want a patch-only release, ensure no pending changeset declares
`minor` / `major`.

## Adding a publishable package

When adding a new package under `packages/*` that ships to npm:

- Add it to the `fixed` block in
  [`.changeset/config.json`](../../../.changeset/config.json) **in the same
  change set** that introduces the package. A publishable package
  outside the `fixed` block silently breaks the lockstep invariant.
- Run `bun run check:fixed-versioning` (also part of `verify:publish`) to
  confirm.

## Do not

- Author a `minor` or `major` changeset. Patch-only is the policy until
  the maintainer rewrites
  [`.cursor/rules/release-version-alignment.mdc`](../../../.cursor/rules/release-version-alignment.mdc).
  Even breaking changes ship as `patch` on the `0.x.y` line.
- Prepare release bumps for only a subset of changed packages. "Only
  package X changed, so only bump X" is the wrong framing for this repo —
  every publishable package gets the new version regardless of whether
  its source changed.
- Remove packages from the `fixed` block to "unblock" a release. That
  hides drift. Escalate to the maintainer instead.
- Run `npm publish` directly, or invoke `bun run release` directly. Use
  `bun run release:with-version` so the temporary all-packages
  changeset, workspace-range rewrite, NPM token load from `.env`, and
  preflight checks all run in the right order.

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
