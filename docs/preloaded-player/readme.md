# Preloaded packages (configs + CI/CD publishing)

This repo supports publishing pre-bundled packages from in-repo element-combination configs.

Each config in `configs/preloaded-player/*.json` represents a fixed set of PIE elements. CI/CD publishes a corresponding `@pie-players/pie-preloaded-player` version for that combination.

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
