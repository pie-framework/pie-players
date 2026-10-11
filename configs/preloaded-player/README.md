# Preloaded player builds

This folder holds the element-set configs that `@pie-players/pie-preloaded-player`
is built from, and this page is the maintainer runbook for building, testing and
publishing them. Hosts install and use the builds as
[Preloaded player](../../docs/preloaded-player/readme.md) describes.

Generated builds are transitional, published for hosts that have not moved off
them. A new integration, or a host moving off them, installs the
pie-elements-ng packages as npm dependencies, every one from the same release
and pinned exactly, and registers their ESM builds with
`registerPreloadedElements`
([Registering elements from npm](../../docs/item-player/loading-strategies.md#registering-elements-from-npm)).
That path needs no config here.

The package has no source under `packages/`. The generator in
[`tools/cli/src/utils/pie-packages/preloaded-static.ts`](../../tools/cli/src/utils/pie-packages/preloaded-static.ts)
produces each build from one config, and bundles its elements with
[`preloaded-elements-build.ts`](../../tools/cli/src/utils/pie-packages/preloaded-elements-build.ts).

## Config format

A config is a JSON array of `{ package, version, tag? }` entries, or an object
`{ "elements": [...], "latest"?, "speechLocales"? }` holding one.

- Every element is a pie-elements-ng package with an ESM browser build
  (`./browser/delivery`); the generator refuses any other.
- A config lists each package once, at an exact version; the generator rejects
  a range or a repeated package.
- `tag` is the base tag the build registers the package under, such as
  `multiple-choice` or `pie-element-multiple-choice`. Omitted, it is
  `pie-<package basename>`. Registration derives each versioned tag from the
  base tag and the pinned version (`toPackageVersionedTag`). Content can author
  the package under another base tag: the player defines that versioned tag from
  the registered element, and changes only versions on its runtime copy of the
  config, leaving authored base tags and model IDs as authored.
- `"latest": true` publishes the set under the `latest` dist-tag in place of its
  name. Exactly one config sets it, and `publish-changed.mjs` rejects a run
  otherwise.
- `speechLocales` lists the math speech locales the build ships, by SRE locale
  id, such as `["en", "es"]`; unset, it ships English. Each must be one SRE
  ships: af, ca, da, de, en, es, fr, hi, it, ko, nb, nn or sv. The speech
  language menu lists only these. `--speechLocales en,es` overrides the config
  for one build.

Configs are unique element combinations: `publish-changed.mjs` rejects a run in
which two of its selected configs share a hash (`validateUniqueCombinations`).

## Sets and versions

The file name is the set's name. It appears in the published version
`<loaderVersion>-<set>.<iteration>` and as the npm dist-tag, so `readElementSet`
requires lowercase letters, digits and hyphens, starting with a letter. Renaming
a file starts a new set.

- `loaderVersion` is the current `packages/item-player` version
  (`resolveDefaultLoaderVersion`); `--loaderVersion` overrides it.
- `iteration` auto-increments per set and loader version. When publishing, the
  CLI sets `PIE_PRELOADED_PLAYER_AUTO_ITERATION=true` and queries the npm
  registry for the next free iteration under the `<loaderVersion>-<set>.`
  prefix. The iteration is a numeric identifier, so within one set and loader
  version, version order is publish order.
- The hash is the content address of the element combination: a 7-character
  sha256 of the config's sorted `package@version` list (`generateHash`),
  published as `pie.bundleHash` beside `pie.set`. A build without `--publish`
  has no set and carries the hash in its place, as `<loaderVersion>-<hash>.1`.
  Publishing needs `--elementsFile`, since the set name comes from the file.

The earlier scheme, `<loaderVersion>-<hash>.<iteration>`, was replaced because a
caret range resolved by how two hashes happened to spell and installed an older
build. Its builds stay installable. Sets compare lexically against each other,
so a caret range is still unsafe and hosts pin exact versions.

A publish carries one dist-tag, the set's name or `latest`, because the workflow
publishes through npm's OIDC trusted publishing, which authorizes `npm publish`
and not `npm dist-tag`. `--publishTag` overrides the tag for one publish. `next`,
the tag every build carried under the earlier scheme, no longer moves.

## Generated package

`buildPreloadedPlayerStaticPackage` assembles one ES module tree whose runtime
imports are all relative, with every dependency included:

- `dist/pie-item-player.js`, `dist/preloaded.js` and their sibling chunks and
  assets: the complete `packages/item-player` build. `preloaded.js` is the
  player's registration entry, `@pie-players/pie-item-player/preloaded`.
- `dist/elements/index.js` and its chunks and assets: every element in the
  config at its pinned version, bundled by Vite from a scratch install of the
  packages, exporting the element classes by package. React is the one
  dependency the elements' browser builds leave to the page
  (`pie.browserSharedDependencies`); the bundle holds a single copy, and the
  generator refuses elements that share different versions of it.
- `dist/mathjax/npm/`: the files MathJax loads as it renders, for the MathJax 4
  bundled into the elements' chunks and the item player's. Under
  `<package>@<version>/`, for each package the math adapter lists in
  `pie.assetPackages`, it holds the fonts' `chtml/woff2`,
  `sre/speech-worker.js` and the speech rules of `base`, the Nemeth and Euro
  braille codes and the config's `speechLocales`, with each package's
  `package.json` and license.
- `dist/index.js`: the entry hosts import.
- `package.json` with a `pie` metadata block (`set` on a published build,
  `bundleHash`, `iteration`, `loaderVersion`, `generatedAt` and the resolved
  `elements` map),
  and `dist/index.d.ts` declaring `Window.PIE_PRELOADED_ELEMENTS`.

The build takes elements on `@pie-element/shared-math-rendering-mathjax` 0.1.3
or later. The generator refuses an element whose adapter copy lacks the
`/bundled` and `/no-assets` markers or names a jsDelivr MathJax URL, a speech
locale SRE does not ship, and an adapter that lists no `pie.assetPackages`.

The entry runs three steps, each import with retry and backoff:

1. It imports `preloaded.js`, then `elements/index.js`.
2. It registers the element classes, without controllers, under the configured
   versioned tags through `registerPreloadedElements`, which records each
   package's spec in `window.PIE_PRELOADED_ELEMENTS`. The call passes
   `math.assetUrls`, each shipped file's npm path mapped to its
   `new URL("./mathjax/npm/…", import.meta.url)`, and the shipped locales as
   `math.speechLocales`.
3. It imports `pie-item-player.js` unless the page already registered
   `pie-item-player`. `pie-item-player.js` runs its readiness assertion against
   whatever is already registered, so it loads last.

The entry then announces the load with the legacy fixed player's signal, which
hosts listen for
([Upgrading from pie-fixed-player-static](../../docs/preloaded-player/readme.md#upgrading-from-pie-fixed-player-static)).

The build's item player registers through `definePieItemPlayer`, the only
registration path, which leaves an already-registered tag alone. The component
declares no `svelte:options customElement` tag, because Svelte's own define runs
unguarded at module scope and a second copy threw `NotSupportedError`. The copy
takes no tag of its own, because multiple-choice, EBSR and passage find their
player with `closest('pie-player') || closest('pie-item-player')` to read
`base-heading-level` and `include-sr-heading`, and the theme's font scaling
targets `pie-item-player` by tag name.

## Local build

```bash
bun run cli pie-packages:preloaded-player-build-package \
  --elementsFile configs/preloaded-player/<set>.json
```

`pie-packages:preloaded-player-build-and-test-package` takes the same flags and
`--generateTestProject`, which also generates a test project for the build:

```bash
bun run cli pie-packages:preloaded-player-build-and-test-package \
  --elementsFile configs/preloaded-player/<set>.json \
  --generateTestProject
```

## Tests

The critical item-player suite includes two generated-package browser
regressions. Each installs and bundles a pinned multiple-choice package through
the real generator, packs the output with Bun, and serves only the extracted
tarball over HTTP, so workspace imports and runtime bundle fetching cannot
conceal an incomplete package.

- `item-player-generated-preloaded.spec.ts` verifies chunk delivery, full
  package specs, authored tags with a stale version, an authored base tag other
  than the build's in hosted and client players, import readiness, repeated
  registration, unchanged authored content, actual answer updates and both load
  signals. A missing-element fault verifies import rejection.
- `item-player-generated-preloaded-bundled-mathjax.spec.ts` builds on adapter
  0.1.3 and verifies that the entry lists each MathJax file the build ships, that
  math renders with no page MathJax, loading its fonts, mhchem's font extension
  and the speech worker from the build, and that the item player's own MathJax
  speaks the item's markup in English alone. It then bundles a host page that
  imports the package with Vite and verifies the page renders and speaks math
  from the files Vite emitted.

```bash
bun run build:e2e:item-player
bunx playwright test packages/item-player/tests/item-player-generated-preloaded.spec.ts packages/item-player/tests/item-player-generated-preloaded-bundled-mathjax.spec.ts --config packages/item-player/playwright.config.ts
```

## CI/CD

[`.github/workflows/publish-preloaded-player.yml`](../../.github/workflows/publish-preloaded-player.yml)
runs
[`scripts/preloaded-player/publish-changed.mjs`](../../scripts/preloaded-player/publish-changed.mjs)
and is the sole publisher of `@pie-players/pie-preloaded-player`. npm permits
exactly one trusted publisher per package, and the trusted-publisher record for
this package names this workflow file (`scripts/configure-trusted-publishers.mjs`).
A second publish path would race this one for the same version or publish
without provenance, so `bun run release` does not publish preloaded packages and
no other workflow does. A versioned release still triggers this workflow,
because a version bump touches `packages/item-player/**`,
`packages/players-shared/**` and `package.json`.

A push to `master` touching `configs/preloaded-player/**`,
`packages/item-player/**`, `tools/cli/**`, `packages/players-shared/**`,
`scripts/preloaded-player/**`, `package.json`, `bun.lock` or the workflow file
runs `publish-changed.mjs --base <before-sha> --head <sha>`, which:

- rebuilds and republishes every config when the diff touched
  `packages/item-player/`, `tools/cli/`, `packages/players-shared/` or
  `scripts/preloaded-player/`, the inputs every build shares, or when `base` is
  the all-zero SHA (a first push or a force-push). Tests, Playwright configs and
  Markdown under those paths do not count (`NOT_BUILD_INPUTS`);
- otherwise rebuilds only the configs whose own JSON file changed.

To publish every config regardless of what changed, run the workflow manually
with `publishAll=true` (`publish-changed.mjs --all`).

Authentication mirrors `release.yml`: `auto` resolves to token auth while the
`NPM_TOKEN` secret exists and to OIDC trusted publishing once it is deleted
([Releasing](../../docs/setup/publishing.md)).
