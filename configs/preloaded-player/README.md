# Preloaded build configs

This folder contains configuration files used to build and publish variants of:

- `@pie-players/pie-preloaded-player`

Each config represents a set of PIE elements (package + version) bundled for `pie-item-player`.

## Local build

```bash
bun run cli pie-packages:preloaded-player-build-package --elements-file configs/preloaded-player/<name>.json
```

## CI/CD

Workflow: `.github/workflows/publish-preloaded-player.yml`

See `docs/preloaded-player/README.md` for full publishing behavior.
