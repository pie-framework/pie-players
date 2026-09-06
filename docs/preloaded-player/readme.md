# Preloaded player (`@pie-players/pie-preloaded-player`)

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
[`tools/cli/src/utils/pie-packages/fixed-static.ts`](../../tools/cli/src/utils/pie-packages/fixed-static.ts).

## What the generated package contains

`buildPreloadedPlayerStaticPackage` (`fixed-static.ts:449`) assembles:

- `dist/pie-item-player.js` and its sibling chunks and assets — the complete
  `packages/item-player` build, so relative imports work from a static server.
- `dist/pie-elements-bundle-<hash>.js` — one IIFE bundle fetched from the PITS
  bundle service at `https://proxy.pie-api.com/bundles/<pkg@ver>+<pkg@ver>.../player.js`,
  containing every element listed in the config, at the pinned versions.
- `dist/math-rendering.js` — `@pie-lib/math-rendering-module`, patched to drop
  an `eval(require)` call that doesn't survive bundling.
- `dist/index.js` — the entry point actually imported by consumers (see below).
- `package.json` with a `pie` metadata block (`bundleHash`, `iteration`,
  `loaderVersion`, resolved `elements` map) and `dist/index.d.ts` declaring
  `Window.PIE_PRELOADED_ELEMENTS`.

Importing `dist/index.js` is a side-effecting module load, not an API call:

1. It merges the config's elements into `window.PIE_PRELOADED_ELEMENTS`
   (`{"@pie-element/multiple-choice": "@pie-element/multiple-choice@11.4.3", ...}`).
2. It sequentially imports the math-rendering module and the elements bundle,
   registers the raw PITS constructors under the configured versioned tags,
   then imports `pie-item-player.js`, each import with retry/backoff. That order
   matters: `pie-item-player.js` runs its readiness assertion (below) against
   whatever is already registered, so it must load last.

Nothing else is exposed to the consumer — there's no explicit "register"
call. Once the module has loaded, `<pie-item-player strategy="preloaded">`
picks up the already-registered elements.

The generated ES module awaits initialization. A completed `await import(...)`
means registration finished; an initialization failure rejects the import.
Registration also records the existing `player.js` registry metadata, with
controllers left server-side, and preserves a previous host's registration.

## Version scheme

`<loaderVersion>-<hash>.<iteration>`, e.g. `0.3.48-963a099.1`.

- `loaderVersion` defaults to the current `packages/item-player` version
  (`resolveDefaultLoaderVersion`, `fixed-static.ts:34`).
- `hash` is a 7-char sha256 of the config's sorted `package@version` list
  (`generateHash`, `fixed-static.ts:25`) — the content-address of that
  element combination.
- `iteration` auto-increments per unique hash: when publishing, the CLI sets
  `PIE_PRELOADED_PLAYER_AUTO_ITERATION=true` and queries the npm registry for
  the next free iteration for that hash (`preloaded-player-build-package.ts:168`);
  local builds default to `1`.

`publish-changed.mjs` enforces that no two configs share a hash
(`validateUniqueCombinations`) — configs must be unique element combinations,
not just unique filenames. A config's optional `tag` field selects its authored
base tag, such as `multiple-choice` or `pie-element-multiple-choice`. Omitting
it selects `pie-<package basename>`. The generator uses the shared public
`makeUniqueTags` transform to compute versioned registrations. Match the base
name in authored content; the player only substitutes bundled versions on its
runtime copy. It does not rename arbitrary authored tags or alter model IDs.

## Local usage

```bash
bun run cli pie-packages:preloaded-player-build-package \
  --elementsFile configs/preloaded-player/knowledge-checks.json
```

```bash
bun run cli pie-packages:preloaded-player-build-and-test-package \
  --elementsFile configs/preloaded-player/knowledge-checks.json \
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
`ElementLoader.assertRegistered(tags)`, a synchronous check that throws
`ElementAssertionError` if any required tag isn't already in
`customElements`. Importing `@pie-players/pie-preloaded-player` before
mounting the player is what makes that assertion pass; there is no fallback
to bundle fetching if it doesn't.

```html
<script type="module">
  import "@pie-players/pie-preloaded-player";
</script>
<pie-item-player strategy="preloaded" config="..." env="..." session="...">
</pie-item-player>
```

Because the item author's `config.elements` may name a slightly different
patch version than what actually got bundled, the player rewrites those
specs to whatever `window.PIE_PRELOADED_ELEMENTS` reports before asserting
(`normalizePreloadedElementVersions`, `PieItemPlayer.svelte:595`).

## Section player

Section player renders each item through `<pie-item-player>` and maps its own
`player-type` straight onto the item player's `strategy` (`preloaded` →
`preloaded`), so `preloaded` is a supported section-player strategy today —
see the mapping table in
[`docs/item-player/loading-strategies.md`](../item-player/loading-strategies.md#section-player-integration).
Section player's own pre-warm step (`warmupSectionElements`,
`packages/section-player/src/components/shared/player-preload.ts:360`) calls
the same `assertRegistered` for `strategy="preloaded"` that item-player uses.

What section player does **not** do is import
`@pie-players/pie-preloaded-player` itself — that package has no
section-player consumer today. Getting elements registered before setting
`playerType: "preloaded"` is left to the host, exactly as it is for a bare
`<pie-item-player>`: import the package (or otherwise pre-register the
elements) before mounting the section player. The
`preloaded-fixed-elements` demo
(`apps/section-demos/src/routes/(demos)/preloaded-fixed-elements/+page.svelte`)
shows the pattern, though it fetches the PITS bundle itself rather than
consuming the published package.

## Upgrading from `pie-fixed-player`

`@pie-framework/pie-fixed-player-static` (built and published from
`pie-api-aws`'s custom-element build chain, retired 2026-08-14) predates this
package and served the same purpose. `<pie-fixed-player>` took the same
`config`/`session`/`env` props plus the full behavioral/styling set
(`addCorrectResponse`, `renderStimulus`, `allowedResize`, `showBottomBorder`,
`customClassname`, `containerClass`, `passageContainerClass`,
`externalStyleUrls`, `loaderConfig`, `debug`) that `<pie-item-player>` still
exposes today (`PieItemPlayer.svelte:10-18,164-172`), and both assume
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

## CI/CD

The critical item-player suite includes a generated-package browser regression.
It fetches the pinned multiple-choice PITS bundle through the real generator,
packs the output with Bun, and serves only the extracted tarball over HTTP.
It verifies chunk delivery, full package specs, authored tags with a stale
version, import readiness, repeated registration, unchanged authored content,
and actual answer updates. A missing-element fault verifies import rejection.
Executable modules and player assets must come from that server; the
existing math renderer's separate Speech Rule Engine JSON data requests are
allowed. Workspace imports and runtime bundle fetching cannot conceal an
incomplete package.

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
  covers `packages/**` and `package.json`, both of which a version bump
  touches.
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
  SHA (first push / force-push);
- otherwise rebuilds only the configs whose own JSON file changed.

To publish every config regardless of what changed, run the workflow
manually with `publishAll=true` (`publish-changed.mjs --all`).

Authentication mirrors `release.yml`: `auto` resolves to token auth while the
`NPM_TOKEN` secret exists and to OIDC trusted publishing once it is deleted.
See [`docs/setup/publishing.md`](../setup/publishing.md).
