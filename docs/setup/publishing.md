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
- `publint` package surface checks
- ATTW type-surface checks (`scripts/check-attw.mjs`)
- pack exports check (`npm pack --dry-run` + export target verification)
- pack smoke check (`npm pack` tarball verification)
- dependency, source export policy, and runtime boundary checks

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

Use the same gate as CI before publish:

```bash
bun run version
bun run release:manual
```

`release:manual` now runs:

1. `check:npm-auth` (fails fast if npm auth is missing/expired or `@pie-players` access is unavailable)
2. `verify:publish`
3. workspace tests
4. release publish

If you hit errors like:

- `npm notice Access token expired or revoked`
- `E404 Not Found - PUT https://registry.npmjs.org/@pie-players%2f...`

re-auth locally and verify org access before retrying:

```bash
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm org ls pie-players --registry=https://registry.npmjs.org/
```
