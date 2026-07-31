# Preloaded packages (configs + CI/CD publishing)

This repo supports publishing pre-bundled packages from in-repo element-combination configs.

Each config in `configs/preloaded-player/*.json` represents a predefined set of PIE elements. CI/CD publishes a corresponding `@pie-players/pie-preloaded-player` version for that combination.

## Package

- `@pie-players/pie-preloaded-player`

## Local usage

```bash
bun run cli pie-packages:preloaded-player-build-package \
  --elements-file configs/preloaded-player/example.json
```

```bash
bun run cli pie-packages:preloaded-player-build-and-test-package \
  --elements-file configs/preloaded-player/example.json \
  --generate-test-project
```

## CI/CD

Workflow:

- `.github/workflows/publish-preloaded-player.yml`

Publisher script:

- `scripts/preloaded-player/publish-changed.mjs`

`publish-preloaded-player.yml` is the **sole publisher** of `@pie-players/pie-preloaded-player`, and must stay that way.

npm permits exactly one trusted publisher per package, and the trusted-publisher record for this package names this workflow file (see `scripts/configure-trusted-publishers.mjs`). A second publish path would either race this one for the same version or publish without provenance, so:

- `bun run release` does **not** publish preloaded packages. It used to end with `publish-changed.mjs --all`, which meant a versioned release and this workflow both published the same package on the same push. That was removed.
- A versioned release still triggers this workflow anyway: its path filter covers `packages/**` and `package.json`, both of which a version bump touches.
- There was also a second, undocumented workflow (`preloaded-release.yml`) publishing the same package off the same `master` trigger. It was deleted.

To publish every config outside a release, run this workflow manually with `publishAll=true`.

Authentication mirrors `release.yml`: `auto` resolves to token auth while the `NPM_TOKEN` secret exists and to OIDC trusted publishing once it is deleted. See `docs/setup/publishing.md`.
