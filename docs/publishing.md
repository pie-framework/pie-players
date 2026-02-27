# Publishing Contract

This repository publishes multiple workspace packages to npm. To keep releases
predictable for external consumers, publishing is gated by metadata and artifact
validation checks.

## Required package metadata (publishable workspaces)

For every non-private workspace package in `packages/*` and `tools/*`:

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
- `docs/PUBLISHABLE_PACKAGES.md` (current package inventory)

## Local preflight before opening/merging a release

Run:

```bash
bun run verify:publish
```

`verify:publish` executes:

- package build
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
  - `publish` (requires version bump/changelog evidence)

Publish-path runs execute the full `bun run verify:publish` gate before
`changesets/action` can publish.

## Common remediation

- Metadata failures: update package `package.json` fields listed in the error.
- `publint` failures: align `exports`, `types`, and packed files with published
  entry points.
- ATTW failures: fix type entrypoints/resolution issues or move package to the
  documented exclusion set with rationale until remediated.
- Pack export/smoke failures: ensure all declared targets are included in `files`
  and produced by build output.
