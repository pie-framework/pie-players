# Publishing Contract

This repository publishes multiple workspace packages to npm. To keep releases
predictable for external consumers, publishing is gated by metadata and artifact
validation checks.

## Versioning model

The monorepo uses Changesets **fixed versioning** for all publishable
`@pie-players/*` packages:

- all publishable packages move in a lockstep release train
- all publishable packages share one version at publish time
- source manifests keep internal references as `workspace:*`
- publish rewrites workspace refs to concrete versions, then restores manifests

### Why fixed (lockstep) versioning

Publishable packages in this repo form a single cohesive player framework
(players, tools, TTS servers, theming, toolkits). Internal contracts cross
package boundaries — element registration, theme tokens, tool coordination,
session shape — so consumers almost always adopt the suite as a whole.

Fixed versioning gives consumers two guarantees:

1. **One version per upgrade.** Pick a version, bump every `@pie-players/*`
   dependency to it. There is no compatibility matrix to reason about across
   `@pie-players/*` packages.
2. **Tested together.** Packages that publish at the same version are designed
   and tested as a unit at that version.

The cost is that releases bump **every** publishable package — including ones
whose source did not change in that release — so some churn is unavoidable on
every release PR. This is expected and enforced.

### Consequences for release preparation

- Every release/versioning step must cover **all** publishable packages. Do not
  prepare a release bump scoped to only the changed packages; that would break
  the lockstep invariant. See
  [`.cursor/rules/release-version-alignment.mdc`](../../.cursor/rules/release-version-alignment.mdc).
- While the project remains on the pre-1.0 `0.x.y` line, every release is a
  `patch` bump across every publishable package, even when a change is
  breaking. Document breaking changes clearly in the changeset body, but do not
  author `minor` or `major` changesets unless the maintainer explicitly updates
  the release policy.
- Changesets' `fixed` block in
  [`../../.changeset/config.json`](../../.changeset/config.json) is the source
  of truth for which packages are in the lockstep set. New publishable packages
  must be added there.
- `scripts/check-fixed-versioning.mjs` (run via `bun run verify:publish`) is the
  invariant check that fails CI if versions drift.

## Required package metadata (publishable workspaces)

For every non-private workspace package in `packages/*`:

- `publishConfig.access` must be `public`
- `license` must be present
- `homepage` must be present
- `bugs` must be present (`string` URL or object with `url`)
- `repository.directory` must match workspace location
- `files` must be present and non-empty
- `exports` or (`main` + `types`) must be present
- `engines.node` must be present
- `sideEffects` must be explicitly set

Policy and validator:

- `scripts/publish-policy.json`
- `scripts/check-package-metadata.mjs`
- `docs/setup/publishable_packages.md` (current package inventory)

## Local preflight before opening/merging a release

Run:

```bash
bun run verify:publish
```

`verify:publish` executes:

- package build
- fixed-versioning invariants (`scripts/check-fixed-versioning.mjs`)
- metadata policy validation
- custom-element contract checks (`check:custom-elements`, `check:ce-define-safety`)
- `publint` package surface checks
- ATTW type-surface checks (`scripts/check-attw.mjs`)
- pack exports check (`npm pack --dry-run` + export target verification)
- pack smoke check (`npm pack` tarball verification)
- Node consumer import boundary checks (`scripts/check-node-consumer-imports.mjs`)
- dependency, publish-surface, sourcemap, and runtime boundary checks

## Dist-only publish surface

Publishable packages expose generated `dist` artifacts as their public API. Package
`exports`, `main`, `module`, `types`, CDN fields, and packed source-bearing files
must not point at raw source paths such as `src`, root `.ts`/`.tsx`, `.svelte`,
`.svelte.ts`, or `development` conditions that resolve to source.

Debuggability is provided by generated sourcemaps, not by importable source files.
`bun run check:sourcemaps` rejects packed `.js.map` files that reference source
files missing from the npm tarball unless the map embeds source content.

The common gates are:

- `bun run check:publish-surface`
- `bun run check:sourcemaps`

## Release intent in CI

The release workflow enforces explicit intent:

- Push-driven runs rely on release evidence:
  - `.changeset/*.md` files for release PR creation
  - package/changelog version bumps for publish runs
- Manual runs (`workflow_dispatch`) require `release_intent`:
  - `version-pr` (requires changesets)
  - `publish` (requires version bump/changelog evidence by default)
  - `publish` + `force_publish=true` (manual recovery mode for rerunning a failed publish from `master`)

### Manual publish recovery

If a publish failed for transient reasons (registry outage, webhook issue, etc.) and
your fixes are already in `master`, rerun the release workflow manually:

1. Open **Actions → Release → Run workflow**
2. Branch: `master`
3. `release_intent`: `publish`
4. `force_publish`: `true`

This bypasses version-bump detection checks for that manual run while keeping normal
push-driven safety checks in place.

Publish-path runs execute the full `bun run verify:publish` gate before
`changesets/action` can publish.

After publish, CI also validates internal dependency closure in the registry:

- `scripts/check-published-closure.mjs`
- confirms published `@pie-players/*` packages only reference resolvable internal versions
- fails if any `workspace:*` leak or unresolved internal dependency is detected

## Common remediation

- Metadata failures: update package `package.json` fields listed in the error.
- `publint` failures: align `exports`, `types`, and packed files with published
  entry points.
- ATTW failures: fix type entrypoints/resolution issues or move package to the
  documented exclusion set with rationale until remediated.
- Pack export/smoke failures: ensure all declared targets are included in `files`
  and produced by build output.
- Fixed-versioning failures:
  - ensure all publishable package versions are identical after `bun run version`
  - ensure internal `@pie-players/*` deps remain `workspace:*` in source manifests

## Local release retry (without re-bumping versions)

If `bun run release:with-version` fails after `bun run version` has already updated
`package.json` and `CHANGELOG.md` files, do not rerun `release:with-version`.
Rerunning it creates another temporary changeset and bumps versions again.

Retry from the post-version steps instead:

```bash
bun run check:npm-auth && SKIP_NPM_VERSION_SEQUENCE_CHECK=1 bun run verify:publish && bun run test && bun run release && bun run restore:workspace-ranges
```

Use `SKIP_NPM_VERSION_SEQUENCE_CHECK=1` for recovery runs when
`check-fixed-versioning` fails with npm `E404` for a package being published for
the first time (for example `npm view @pie-players/<pkg> version` returning not
found).

## Manual publishing (local)

Local publishing always uses the codebase and branch currently checked out.
Before running the publish command, confirm `git branch --show-current` and
`git status --short`; do not switch to `master`, `main`, `develop`, or the
GitHub workflow unless that is explicitly requested.

The canonical local-publish command is:

```bash
bun run release:with-version
```

`release:with-version` runs the entire CI release path locally, in order:

1. `scripts/create-temporary-release-changeset.mjs` — writes a temporary
   `.changeset/temporary-release-all-packages.md` declaring `patch` for every
   publishable package, so the lockstep set is always covered (existing
   author-written changesets coexist with this temporary one and may upgrade
   the bump for some / all packages).
2. `bun run version` — applies all changesets to `package.json` and
   `CHANGELOG.md` files.
3. `bun run restore:workspace-ranges` — keeps source manifests on
   `workspace:*` after `version`.
4. `bun run check:npm-auth` — fails fast if the NPM token in `.env` is
   missing/expired or `@pie-players` access is unavailable.
5. `bun run verify:publish` — full publish gate (build + every `check:*`).
6. `bun run test` — workspace test suites.
7. `bun run release` — `dotenvx run -f .env` wrapper around build +
   `changeset publish` (with workspace ranges resolved) + preloaded-player
   bundle publish.
8. `bun run restore:workspace-ranges` — restore `workspace:*` ranges in
   source manifests.

NPM authentication: the repo's `.env` file holds the `NPM_TOKEN` for
`@pie-players` publish access. Both `check:npm-auth` and `release` load it via
`dotenvx run -f .env`. No separate `npm login` is needed.

If you hit errors like:

- `npm notice Access token expired or revoked`
- `E404 Not Found - PUT https://registry.npmjs.org/@pie-players%2f...`

verify the token in `.env` is still valid (or re-auth and update `.env`):

```bash
npm whoami --registry=https://registry.npmjs.org/
npm org ls pie-players --registry=https://registry.npmjs.org/
```
