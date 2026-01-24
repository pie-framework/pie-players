# Fixed player static build configs

This folder contains **configuration files** used to build and publish variants of:

- `@pie-framework/pie-fixed-player-static`

Each config represents a set of PIE elements (package + version) that should be bundled into a fixed-player static build.

## File format

Each `*.json` file can be either:

### 1) Array form (compatible with `star-packages.json`)

```json
[
  { "package": "@pie-element/multiple-choice", "version": "11.4.3", "tag": "pie-element-multiple-choice" },
  { "package": "@pie-element/passage", "version": "5.3.3", "tag": "pie-element-passage" }
]
```

### 2) Object form

```json
{
  "elements": [
    { "package": "@pie-element/multiple-choice", "version": "11.4.3" },
    { "package": "@pie-element/passage", "version": "5.3.3" }
  ]
}
```

## How it is used

- **Local/manual build** (from repo root):

```bash
bun run cli pie-packages:fixed-player-build-package --elements-file configs/fixed-player-static/<name>.json
```

- **CI/CD**: on `main`, the workflow `.github/workflows/publish-fixed-player-static.yml` publishes:
  - only configs changed in the pushed commit range, or
  - **all configs** if `packages/pie-fixed-player/` or the CLI/build plumbing changed (to bump `.iteration` for the same element combinations).

See `docs/fixed-player-static/README.md` for the full workflow, versioning rules, and how to add/change/remove configs.


