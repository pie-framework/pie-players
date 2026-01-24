# Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) to version and publish only the packages that actually changed.

## Creating a changeset

From the repo root:

```bash
bun run changeset
```

Select the packages you changed and choose the appropriate semver bump (patch/minor/major).

## Release flow (CI)

- Work is merged into `develop` via PRs.
- Releases happen via PR from `develop` → `master`.
- On push/merge to `master`, GitHub Actions creates/updates a **Version Packages** PR.
- Merging the Version Packages PR publishes updated packages to npm.

## Manual release (local)

If you need to publish from your machine (use sparingly):

```bash
bun run release
```


