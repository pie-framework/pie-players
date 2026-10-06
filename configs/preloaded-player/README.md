# Preloaded build configs

This folder contains configuration files used to build and publish variants of:

- `@pie-players/pie-preloaded-player`

Each config represents a set of PIE elements (package + version) bundled for `pie-item-player`.
Every element must be a pie-elements-ng package with an ESM browser build
(`./browser/delivery`); the build refuses any other.

Generated builds are transitional, published for hosts that have not moved off
them. A host integrating now, or moving, installs the pie-elements-ng packages
as npm dependencies, every one from the same release and pinned exactly, and
registers their ESM builds with `registerPreloadedElements`
([Registering elements from npm](../../docs/item-player/loading-strategies.md#registering-elements-from-npm)).
That path needs no config here.

The file name is the set's name, in its published versions
(`<loaderVersion>-<set>.<iteration>`) and as its npm dist-tag, so it uses
lowercase letters, digits and hyphens and starts with a letter. Renaming a file
starts a new set. Exactly one config sets `"latest": true`, in the
`{ "latest": true, "elements": [...] }` form, and publishes under `latest` in
place of its name.

An element's optional `tag` is the base tag to register, for example
`multiple-choice`. Omit it to use `pie-<package basename>`. The generated package
adds the canonical version suffix. Content can author another base tag for the
same package; the player defines that versioned tag from the registered element.

An optional `speechLocales`, in the object form, lists the math speech locales
the build ships, by SRE locale id, such as `["en", "es"]`; unset, it ships
English. Each must be one SRE ships: af, ca, da, de, en, es, fr, hi, it, ko,
nb, nn or sv. The speech language menu lists only these. `--speechLocales en,es`
overrides the config for one build.

## Local build

```bash
bun run cli pie-packages:preloaded-player-build-package --elementsFile configs/preloaded-player/<name>.json
```

## CI/CD

Workflow: `.github/workflows/publish-preloaded-player.yml`

See [the preloaded-player workflow](../../docs/preloaded-player/readme.md) for full publishing behavior.
