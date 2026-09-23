# Preloaded build configs

This folder contains configuration files used to build and publish variants of:

- `@pie-players/pie-preloaded-player`

Each config represents a set of PIE elements (package + version) bundled for `pie-item-player`.

The file name is the set's name, in its published versions
(`<loaderVersion>-<set>.<iteration>`) and as its npm dist-tag, so it uses
lowercase letters, digits and hyphens and starts with a letter. Renaming a file
starts a new set. Exactly one config sets `"latest": true`, in the
`{ "latest": true, "elements": [...] }` form, and publishes under `latest` in
place of its name.

An element's optional `tag` is the authored base tag to register, for example
`multiple-choice`. Omit it to use `pie-<package basename>`. The generated package
adds the canonical version suffix; content must use the same base tag.

## Local build

```bash
bun run cli pie-packages:preloaded-player-build-package --elementsFile configs/preloaded-player/<name>.json
```

## CI/CD

Workflow: `.github/workflows/publish-preloaded-player.yml`

See [the preloaded-player workflow](../../docs/preloaded-player/readme.md) for full publishing behavior.
