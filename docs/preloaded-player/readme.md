# Preloaded player (`@pie-players/pie-preloaded-player`)

The generated package is transitional. `strategy="preloaded"` means ESM
builds of pie-elements-ng that the host installs as npm dependencies and
registers with `registerPreloadedElements`
([Loading strategies](../item-player/loading-strategies.md#registering-elements-from-npm)),
so a new integration needs no generated build. The package stays published for
hosts that have not moved yet, and this page documents it for them.

`@pie-players/pie-preloaded-player` is a build-time-generated package: a fixed
set of PIE elements, pinned to specific versions, bundled together with
`pie-item-player` into one importable package. It is the replacement for the
old `@pie-framework/pie-fixed-player(-static)` line — same idea (ship a
self-contained player for a known element combination, no runtime bundle
fetch), rebuilt on the current item-player/loading-strategy architecture.

There is no source package for it under `packages/`. Each variant is produced
from a config in `configs/preloaded-player/*.json` (an array, or
`{elements: [...]}`, of `{package, version}` pairs — see
[`configs/preloaded-player/README.md`](../../configs/preloaded-player/README.md))
by the generator in
[`tools/cli/src/utils/pie-packages/preloaded-static.ts`](../../tools/cli/src/utils/pie-packages/preloaded-static.ts),
which bundles the elements with
[`preloaded-elements-build.ts`](../../tools/cli/src/utils/pie-packages/preloaded-elements-build.ts).
Every element must be a pie-elements-ng package with an ESM browser build
(`./browser/delivery`); the generator refuses any other.

## What the generated package contains

`buildPreloadedPlayerStaticPackage` assembles one ES module tree whose runtime
imports are all relative, with every dependency included:

- `dist/pie-item-player.js`, `dist/preloaded.js` and their sibling chunks and
  assets — the complete `packages/item-player` build, so relative imports work
  from a static server. `preloaded.js` is the player's registration entry,
  `@pie-players/pie-item-player/preloaded`.
- `dist/elements/index.js` and its chunks and assets — every element in the
  config at its pinned version, bundled by Vite from a scratch install of the
  packages. It exports the element classes by package and
  `startMathRendering`. React is the one dependency the elements' browser builds
  leave to the page (`pie.browserSharedDependencies`); the bundle holds a single
  copy, and the generator refuses elements that share different versions of it.
- `dist/mathjax/` — the MathJax 4 the elements' math adapter expects, with its
  extensions, speech data, and the New Computer Modern font and the mhchem font
  extension for both output renderers, plus `load.js`, which points MathJax's
  `mathjax` and `fonts` paths at this directory. A set whose elements render no
  math ships none. The generator refuses a build whose adapter copies expect
  another MathJax version, or one that predates the shared page-wide load.
- `dist/index.js` — the entry point actually imported by consumers (see below).
- `package.json` with a `pie` metadata block (`set` on a published build,
  `bundleHash`, `iteration`, `loaderVersion`, resolved `elements` map) and `dist/index.d.ts` declaring
  `Window.PIE_PRELOADED_ELEMENTS`.

Importing `dist/index.js` is a side-effecting module load, not an API call. It
runs four steps in order, each import with retry/backoff:

1. It imports `preloaded.js`, then `elements/index.js`.
2. It starts the page's MathJax load from `dist/mathjax/load.js`. Each
   element's copy of the adapter finds that load in flight and waits on it, so
   no MathJax, font or speech file comes from a CDN. A page that installed its
   own `window["@pie-lib/math-rendering"]` renderer keeps it, and nothing loads.
3. It registers the element classes, without controllers, under the configured
   versioned tags through `registerPreloadedElements`, which records each
   package's spec in `window.PIE_PRELOADED_ELEMENTS`
   (`{"@pie-element/multiple-choice": "@pie-element/multiple-choice@14.0.0", ...}`).
4. It imports `pie-item-player.js` unless the page already registered
   `pie-item-player` ([below](#the-builds-own-item-player)).
   `pie-item-player.js` runs its readiness assertion (below) against whatever
   is already registered, so it loads last.

Nothing else is exposed to the consumer — there's no explicit "register"
call. Once the module has loaded, `<pie-item-player strategy="preloaded">`
picks up the already-registered elements.

The generated ES module awaits initialization. A completed `await import(...)`
means registration finished; an initialization failure rejects the import. A
bundler that processes the entry needs an es2022 or later target for that
top-level await: Vite 6 and earlier default to an older target and fail the
build.

A tag the page already defined keeps its definition and its registry entry, so
importing the entry twice is harmless. A package the page already registered at
another version rejects the import, because the players align every authored
version of a package to the registered one.

## Version scheme

`<loaderVersion>-<set>.<iteration>`, e.g. `0.3.74-star-0326-ng.2`.

- `loaderVersion` defaults to the current `packages/item-player` version
  (`resolveDefaultLoaderVersion`).
- `set` is the config's file name: `configs/preloaded-player/star-0326-ng.json`
  publishes the `star-0326-ng` set. `readElementSet` requires lowercase letters,
  digits and hyphens, starting with a letter, because the name is both a semver
  prerelease identifier and an npm dist-tag.
- `iteration` auto-increments per set and loader version: when publishing, the
  CLI sets `PIE_PRELOADED_PLAYER_AUTO_ITERATION=true` and queries the npm
  registry for the next free iteration under the `<loaderVersion>-<set>.`
  prefix.

The iteration is a numeric identifier, so within one set and loader version,
version order is publish order. The previous scheme,
`<loaderVersion>-<hash>.<iteration>`, carried the element hash in that
position, and a caret range resolved by how two hashes happened to spell, which
installed an older build. Builds published under it stay installable; within a
loader version both current set names sort above them.

Sets are not comparable with each other, so a caret range is still unsafe:
`^0.3.74-knowledge-checks.2` resolves to a `star-0326` build, which sorts
after it. Consumers pin an exact version or install by dist-tag.

Publishing needs `--elementsFile`, since the set name comes from the file. A
local build carries the hash in place of the set, `<loaderVersion>-<hash>.1`.

The hash stays the content address of the element combination: a 7-char sha256
of the config's sorted `package@version` list (`generateHash`), published as
`pie.bundleHash` beside `pie.set`.

`publish-changed.mjs` rejects a run in which two of its selected configs share a
hash (`validateUniqueCombinations`) — configs must be unique element combinations,
not just unique filenames. A config lists each package once at an exact
version; the generator rejects a range or a repeated package. A config's
optional `tag` field selects the base tag the build registers the package
under, such as `multiple-choice` or `pie-element-multiple-choice`. Omitting it
selects `pie-<package basename>`. Registration derives each versioned tag from
the base tag and the pinned version (`toPackageVersionedTag`). Content can
author the package under any base tag: the player defines each authored
versioned tag from the registered element
([below](#consuming-it-pie-item-player-and-strategypreloaded)). The player
changes only versions, on its runtime copy; authored base tags and model IDs
stay as authored.

### Dist-tags

Each set publishes under its own name, so
`@pie-players/pie-preloaded-player@knowledge-checks` installs the newest
knowledge-checks build. The config that sets `"latest": true` publishes under
`latest` in place of its name, which today is `star-0326-ng`, and
`publish-changed.mjs` requires exactly one such config. A publish carries one
dist-tag because the workflow publishes through npm's OIDC trusted publishing,
which authorizes `npm publish` and not `npm dist-tag`. `next`, the tag every
build carried under the previous scheme, no longer moves. Neither do
`knowledge-checks` and `star-0326`: those sets bundled legacy IIFE elements, so
their configs are gone, and their published builds stay installable.

## Local usage

```bash
bun run cli pie-packages:preloaded-player-build-package \
  --elementsFile configs/preloaded-player/star-0326-ng.json
```

```bash
bun run cli pie-packages:preloaded-player-build-and-test-package \
  --elementsFile configs/preloaded-player/star-0326-ng.json \
  --generateTestProject
```

## Consuming it: `pie-item-player` and `strategy="preloaded"`

The preloaded package is one of three `<pie-item-player>` loading strategies
(`iife`, `esm`, `preloaded`), all routed through the shared `ElementLoader`
primitive. Full strategy reference, `loaderOptions`, and the section-player
mapping: [`docs/item-player/loading-strategies.md`](../item-player/loading-strategies.md).

The short version: for `iife`/`esm`, the player fetches and registers
elements at render time via `ElementLoader.ensureRegistered`. For
`preloaded`, it does no loading at all — it calls
`ElementLoader.assertRegistered`, a synchronous check that throws
`ElementAssertionError` when a required tag is not in `customElements`, naming
each missing tag and the tags its package is registered as. Importing
`@pie-players/pie-preloaded-player` before mounting the player is what makes
that assertion pass; there is no fallback to bundle fetching if it doesn't.

A host that bundles element packages itself registers them without this
package, through `registerPreloadedElements` from
`@pie-players/pie-item-player/preloaded`; see
[`strategy="preloaded"`](../item-player/loading-strategies.md#strategypreloaded).
A host that evaluates a PITS IIFE bundle itself first awaits
`ensureItemPlayerMathRenderingReady()` from that entry, because IIFE elements
read `window["@pie-lib/math-rendering"]` as they evaluate.

```html
<script type="module">
  import "@pie-players/pie-preloaded-player";
</script>
<pie-item-player strategy="preloaded" hosted config="..." env="..." session="...">
</pie-item-player>
```

Authored `config.elements` can name a different version of a package than the
page registered. Before asserting, the player replaces each spec with the one
`window.PIE_PRELOADED_ELEMENTS` records for the same package
(`alignPreloadedElementVersions` in `@pie-players/pie-players-shared`), on its
runtime copy of the config. A package the map does not name keeps its authored
spec.

Content can also name a registered package under another base tag: one item
authors `multiple-choice`, another `pie-element-multiple-choice`. After
aligning, the player defines each versioned tag the page lacks as a subclass of
the element registered for the same package spec, and records it in
`window.PIE_REGISTRY` with that registration's controller and bundle type
(`defineAuthoredPreloadedTags` in `@pie-players/pie-players-shared`). The item
renders under its authored tag. A tag whose package spec the page did not
register stays undefined, and `assertRegistered` reports it.

### Models and scoring

A generated build registers view elements only: it bundles each element's
`./browser/delivery` build, which carries no controller. The player rendering them has to be hosted (`hosted`,
or `backend.delivery` enabled), so its models arrive server-processed and
scoring happens on the server. A player that is not hosted renders each model as
authored, without running `model()`, and warns once per tag that it has no
controller.

## The build's own item player

A build carries its own copy of `@pie-players/pie-item-player` and registers it
as `pie-item-player` when that tag is free, so on a page holding no other copy
the markup above renders through it. A page that already holds one — anything
importing `@pie-players/pie-section-player` — renders the build's elements
through that copy, and the entry skips fetching its own. Whichever copy
registers `pie-item-player` first renders every item for the life of the
document; a full page load resets it.

`definePieItemPlayer` in `packages/item-player` is the only registration path,
and it leaves an already-registered tag alone. The component declares no
`svelte:options customElement` tag, because Svelte's own define runs at module
scope unguarded: a second copy threw `NotSupportedError` and rejected the
build's initialization.

The build's copy takes no tag of its own: multiple-choice, EBSR and passage find
their player with `closest('pie-player') || closest('pie-item-player')` to read
`base-heading-level` and `include-sr-heading`, and the theme's font scaling
targets `pie-item-player` by tag name, so the player has to answer to
`pie-item-player`.

## Section player

Section player renders each item through `<pie-item-player>` and maps the
host's `runtime.playerType` straight onto the item player's `strategy`
(`preloaded` → `preloaded`), so `preloaded` is a supported section-player
strategy today —
see the mapping table in
[`docs/item-player/loading-strategies.md`](../item-player/loading-strategies.md#section-player-integration).
Section player's own pre-warm step (`warmupSectionElements`,
`packages/section-player/src/components/shared/player-preload.ts`) aligns each
item's and passage's authored versions with the same
`alignPreloadedElementVersions`, defines their authored tags with the same
`defineAuthoredPreloadedTags`, then calls the same `assertRegistered` for
`strategy="preloaded"` that item-player uses, so it asserts the tags the items
mount. When the assertion fails, the items stay unmounted and the section
reports an `element-preload` framework error, delivered like its other framework
errors to `framework-error` and `onFrameworkError`, and as the section
controller's `section-error`. It emits neither the `interactive` stage of
`pie-stage-change` nor `pie-loading-complete`.

What section player does **not** do is import
`@pie-players/pie-preloaded-player` itself — that package has no
section-player consumer today. Getting elements registered before setting
`playerType: "preloaded"` is left to the host, exactly as it is for a bare
`<pie-item-player>`: import the package, or register the elements with
`registerPreloadedElements`, before mounting the section player. The
`preloaded-npm-elements` demo
(`apps/section-demos/src/routes/(demos)/preloaded-npm-elements/+page.svelte`)
shows the pattern with installed pie-elements-ng packages.

## Upgrading from `pie-fixed-player`

`@pie-framework/pie-fixed-player-static` (built and published from
`pie-api-aws`'s custom-element build chain, retired 2026-08-14) predates this
package and served the same purpose. `<pie-fixed-player>` took the same
`config`/`session`/`env` props plus the full behavioral/styling set
(`addCorrectResponse`, `renderStimulus`, `allowedResize`, `showBottomBorder`,
`customClassname`, `containerClass`, `passageContainerClass`,
`externalStyleUrls`, `loaderConfig`, `debug`) that `<pie-item-player>` still
exposes today, and both assume
server-side scoring via an elements-only `player.js` bundle — migrating an
existing integration is mostly a rename, with two behavior changes to expect:

- Swap the import (`@pie-framework/pie-fixed-player-static` →
  `@pie-players/pie-preloaded-player`) and the tag/attribute
  (`<pie-fixed-player ...>` → `<pie-item-player strategy="preloaded" ...>`).
  `strategy="preloaded"` is new — `pie-fixed-player` had no such switch, it
  always assumed elements were already registered.
- `pie-fixed-player` never verified elements were registered before
  rendering; it trusted the DOM. `strategy="preloaded"` calls
  `assertRegistered` and throws `ElementAssertionError` if the page mounts
  the player before `pie-preloaded-player` has finished importing — a
  load-order bug that used to fail silently now fails loudly.
- Publishing moved from `pie-api-aws`'s own build chain into this repo's
  `configs/preloaded-player/*.json` + CI (below). A combination not already
  covered by an existing config needs a new one landed here.

The load signal carries over unchanged. The generated entry dispatches
`PiePlayerLoadEvent` on `document` with detail `PIE-Fixed-Player-Load-Complete`,
marks `PIE-Fixed-Player-Load-Complete` on the performance timeline and sets
`window.pieFixedPlayerLoaded`, for a host that initializes after the player and
misses the dispatch. A failed initialization dispatches
`PIE-Fixed-Player-Load-Failed` before the error propagates. Hosts listen for
it; `item-player-generated-preloaded.spec.ts` pins both states
against the packed tarball.

## CI/CD

The critical item-player suite includes a generated-package browser regression.
It installs and bundles the pinned multiple-choice package through the real
generator, packs the output with Bun, and serves only the extracted tarball
over HTTP.
It verifies chunk delivery, full package specs, authored tags with a stale
version, an authored base tag other than the build's in hosted and client
players, import readiness, repeated registration, unchanged authored content,
actual answer updates, and math rendered by the shipped MathJax with its
fonts, mhchem's `\ce` included. A missing-element fault verifies import
rejection. Every request must reach that server. Workspace imports and runtime
bundle fetching cannot conceal an incomplete package.

```bash
bun run build:e2e:item-player
bunx playwright test packages/item-player/tests/item-player-generated-preloaded.spec.ts --config packages/item-player/playwright.config.ts
```

Workflow: [`.github/workflows/publish-preloaded-player.yml`](../../.github/workflows/publish-preloaded-player.yml)
Publisher script: [`scripts/preloaded-player/publish-changed.mjs`](../../scripts/preloaded-player/publish-changed.mjs)

`publish-preloaded-player.yml` is the **sole publisher** of
`@pie-players/pie-preloaded-player`, and must stay that way. npm permits
exactly one trusted publisher per package, and the trusted-publisher record
for this package names this workflow file (see
`scripts/configure-trusted-publishers.mjs`). A second publish path would
either race this one for the same version or publish without provenance, so:

- `bun run release` does **not** publish preloaded packages. It used to end
  with `publish-changed.mjs --all`, which meant a versioned release and this
  workflow both published the same package on the same push. That was
  removed.
- A versioned release still triggers this workflow anyway: its path filter
  covers `packages/item-player/**`, `packages/players-shared/**` and
  `package.json`, all of which a version bump touches.
- There was also a second, undocumented workflow (`preloaded-release.yml`)
  publishing the same package off the same `master` trigger. It was deleted.

**What triggers a publish.** A push to `master` touching
`configs/preloaded-player/**`, `packages/item-player/**`, `tools/cli/**`,
`packages/players-shared/**`, `scripts/preloaded-player/**`, `package.json`,
`bun.lock`, or the workflow file runs
`publish-changed.mjs --base <before-sha> --head <sha>`, which:

- rebuilds and republishes **every** config if the diff touched
  `packages/item-player/`, `tools/cli/`, `packages/players-shared/`, or
  `scripts/preloaded-player/` — those are shared inputs to every variant's
  `loaderVersion`/build, not per-config data — or if `base` is the all-zero
  SHA (first push / force-push). Tests, Playwright configs and Markdown under
  those paths do not count (`NOT_BUILD_INPUTS`);
- otherwise rebuilds only the configs whose own JSON file changed.

To publish every config regardless of what changed, run the workflow
manually with `publishAll=true` (`publish-changed.mjs --all`).

Authentication mirrors `release.yml`: `auto` resolves to token auth while the
`NPM_TOKEN` secret exists and to OIDC trusted publishing once it is deleted.
See [`docs/setup/publishing.md`](../setup/publishing.md).
