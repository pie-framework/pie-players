# Vendored: `nds-icon-button`

Pre-built bundle of the Renaissance Next Design System (NDS)
`nds-icon-button` component, registered here as `<pie-nds-icon-button>`. This is
the **single source of truth** for
the button across `@pie-players/*`; consumers import it via the package export
`@pie-players/pie-players-shared/nds-icon-button` rather than vendoring their
own copy.

Known consumers:

- `@pie-players/pie-assessment-toolkit` — `ItemToolBar.svelte` toolbar buttons
  and the calculator shell header (chevrons, zoom, close).
- `@pie-players/pie-tool-tts-inline` — the Text-to-Speech play/pause trigger
  and the "more" overflow control.
- `@pie-players/pie-section-player` — the items pane's scroll hint.

It ships as a pre-built single-file bundle (Lit inlined) so consumers get the
button without taking a runtime dependency on Lit or the rest of NDS: the Lit
runtime lives inside this bundle and is inlined/resolved wherever the module
lands, so it never leaks into a consumer's own dependency set.

## Provenance

| Field | Value |
| --- | --- |
| Upstream | NDS component library (`@nds/web`) |
| Source file | `web-components/src/components/icon-button/nds-icon-button.ts` |
| Release | `v5.6.0` |
| Source commit | `a7ed2a9` |
| Inlined Lit | `3.3.3` |
| Bundler | `scripts/sync-nds-icon-button.mjs`: this repository's Vite in lib mode, ES output, single file |

## Licence

The inlined Lit runtime is BSD-3-Clause, Copyright Google LLC. Its `@license`
comments sit in `nds-icon-button.js` and must survive every refresh, since the
licence requires the notice to travel with a redistributed copy.

The NDS component code is Renaissance's own. Its package manifest declares MIT,
and the copy ships inside `@pie-players/pie-players-shared` under that package's
MIT licence (`LICENSE`). Record any different terms Renaissance sets here.

## Why a vendored bundle, not an npm dep

NDS publishes as `@nds/web`, but to a private, access-restricted registry. Every
`@pie-players/*` package is public, so a dependency on it would fail to install
for any host without access to that registry, and so would a build-time
dependency for CI and contributors. Copying the `.ts` source instead would force
a `lit` dependency plus a chunk of foundations CSS onto every downstream
consumer on lockstep release. A pre-built single-file bundle sidesteps both: no
new runtime dependency, and the bundle inlines what it needs. `lit` is a
devDependency of `players-shared` only so the sync script can inline it.

## Registered tag

The bundle registers `pie-nds-icon-button`, under PIE's prefix. A host page that
also loads NDS registers upstream's own `nds-icon-button`, at whatever version it
ships; sharing that name would leave whichever copy defines second skipped, and
every consumer of the other one rendering markup and styles it was not built
against. The sync script patches two sites: the tag passed to the
`defineElement("…")` decorator at the class registration, and the
`nds-icon-button { display: inline-block; }` element selector at the top of
`render()`'s inline `<style>`. The BEM class names (`.nds-icon-button`,
`.nds-icon-button__icon`, modifiers) stay upstream's, and so do the export path
and file names.

Upstream's `defineElement` skips a tag that is already defined (with a console
warning), so registration is idempotent without a patch. It still contains the
literal `customElements.define(` token, so this file is allow-listed in
`scripts/check-ce-define-safety.mjs`.

## One registration per page

The tag is registered at most once per page, by whichever consumer reaches it
first, and that copy serves every consumer. Consumers load the bundle with a
dynamic `import()` the first time an NDS control is about to render, which is
only when the host sets `ndsIcons: true`; a page that never opts in neither
fetches the bundle nor takes the `pie-nds-icon-button` tag. A second copy of the
bundle at a different version loads without error and is skipped by the define
guard, so the first copy to register decides the markup and styles every
consumer sees. A host that loads its own NDS registers upstream's
`nds-icon-button`, a different tag, and is unaffected.

## How this is built and shipped

`players-shared` builds with `tsc`, which does not emit static `.js`/`.d.ts`
vendor files. The package's `build` script copies `src/components/vendor` →
`dist/components/vendor` so the `./nds-icon-button` export resolves. The folder
also sits under `src/components/**`, which `tsconfig.json` excludes from the
TypeScript program, and is covered by the `!**/src/components/vendor` ignore in
`biome.json`.

Consuming bundlers treat this module per their own externals config:

- `tool-tts-inline` (Vite lib build) externalizes `players-shared` and its
  subpaths, so its published output imports
  `@pie-players/pie-players-shared/nds-icon-button` from the host.
- `section-player` externalizes the same specifier for the scroll hint.
- `assessment-toolkit` builds its CE artifacts with every dependency and peer
  dependency, plus each one's subpaths, as esbuild externals, so this module
  stays a bare external import in those artifacts — resolved by the
  host/loader exactly like every other `@pie-players/*` specifier the
  artifacts already emit.

## How to refresh

Never edit `nds-icon-button.js` by hand. With a checkout of the NDS component
library (its release tags fetched), run:

```sh
bun run sync:nds-icon-button -- --source <path to the checkout> [--ref vX.Y.Z]
```

`--ref` defaults to the newest `vX.Y.Z` tag in the checkout. The script reads
that tag through `git archive`, so the checkout's working tree is untouched, and
it neither installs nor runs anything from it: the component's TypeScript is
compiled with this repository's Vite and the `lit` that `players-shared` pins.
It then applies the patches above, failing if either target is missing or
duplicated, and rewrites the provenance rows. After a sync:

1. Update `nds-icon-button.d.ts` for any property upstream added or removed.
2. Rebuild the consumers (`assessment-toolkit`, `tool-tts-inline`,
   `section-player`) and verify the toolbar buttons, the calculator shell, the
   TTS trigger and the scroll hint still mount and register.

## Runtime dependencies

The bundle's `connectedCallback` injects a `<link>` for the Renaissance Roboto
stylesheet, and `render()` emits `fa-light fa-${iconName}` FontAwesome classes.
Each consumer is responsible for providing Roboto and FontAwesome (see the
consuming component for how it wires those assets); this bundle only assumes
they are present.
