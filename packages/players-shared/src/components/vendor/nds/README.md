# Vendored: `nds-icon-button`

Pre-built bundle of the Renaissance Next Design System (NDS)
`nds-icon-button` component, registered here as `<pie-nds-icon-button>`. This is
the **single source of truth** for
the button across `@pie-players/*`; consumers import it via the package export
`@pie-players/pie-players-shared/nds-icon-button` rather than vendoring their
own copy.

Known consumers:

- `@pie-players/pie-assessment-toolkit` — `ItemToolBar.svelte` calculator shell
  header (chevrons, zoom, close).
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
| Upstream | NDS component library |
| Source file | `web-components/src/components/icon-button/nds-icon-button.ts` |
| Last sync commit | `1c728d3` |
| Bundler | Vite 7 in lib mode, ES output, single-file (Lit inlined) |

## Why a vendored bundle, not an npm dep

NDS is not currently published to a registry the `@pie-players/*` chain can
consume. Copying the `.ts` source directly (the path the NDS docs suggest)
would force a `lit` dependency plus a chunk of foundations CSS onto every
downstream consumer on lockstep release. A pre-built single-file bundle
sidesteps both: zero new package deps, the bundle inlines what it needs.

## Registered tag

The bundle registers `pie-nds-icon-button`, under PIE's prefix. A host page that
also loads NDS registers upstream's own `nds-icon-button`, often unguarded and
at a different version; sharing that name would leave whichever copy defines
second either skipped (PIE's guarded define) or throwing (the host's). Two
sites are patched: the `Pt("…")` decorator argument at the class registration,
and the `nds-icon-button { display: inline-block; }` element selector at the top
of `render()`'s inline `<style>`. The BEM class names (`.nds-icon-button`,
`.nds-icon-button__icon`, modifiers) stay upstream's, and so do the export path
and file names.

## Idempotent registration (built-in define guard)

A host page can load more than one `pie-nds-icon-button` consumer (e.g. the
toolkit and the inline TTS tool), and each would otherwise register the tag a
second time and throw `NotSupportedError`. To make registration idempotent
regardless of load order, the Lit `@customElement` decorator helper (`Pt`) in
this bundle is patched to guard the define:

```js
const Pt = (o) => (t, e) => {
  e !== void 0 ? e.addInitializer((() => {
    customElements.get(o) || customElements.define(o, t);
  })) : (customElements.get(o) || customElements.define(o, t));
};
```

Re-apply this guard after any refresh from upstream. Because the guard still
contains the literal `customElements.define(` token, this file is allow-listed
in `scripts/check-ce-define-safety.mjs` (which would otherwise flag it).

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

When a newer `nds-icon-button` is needed:

1. Check out the latest NDS component library source.
2. From its `web-components/` directory, `bun install`.
3. Build a self-contained ESM bundle (no shared chunks) — the upstream
   `vite.bundle.config.js` splits Lit into a `property.js` chunk, which would
   break the single-file copy here. Use this one-shot config instead:

   ```js
   // vite.self-contained.config.js
   import { defineConfig } from 'vite';
   import { resolve } from 'path';
   export default defineConfig({
     publicDir: false,
     build: {
       outDir: resolve(__dirname, 'NDS-Prototypes/dist-bundles-self-contained'),
       emptyOutDir: true,
       minify: true,
       lib: {
         entry: resolve(__dirname, 'src/components/icon-button/nds-icon-button.ts'),
         name: 'NdsIconButton',
         fileName: () => 'nds-icon-button.bundled.js',
         formats: ['es'],
       },
       rollupOptions: { output: { inlineDynamicImports: true } },
     },
   });
   ```

   Then: `bunx vite build --config vite.self-contained.config.js`.
4. Copy the output over this file, re-apply the define guard and the two tag
   renames above, and update the `Last sync commit` row.
5. Rebuild the consumers (`assessment-toolkit`, `tool-tts-inline`) and verify
   the calculator shell and the TTS trigger still mount and register.

## Runtime dependencies

The bundle's `connectedCallback` injects a `<link>` for the Renaissance Roboto
stylesheet, and `render()` emits `fa-light fa-${iconName}` FontAwesome classes.
Each consumer is responsible for providing Roboto and FontAwesome (see the
consuming component for how it wires those assets); this bundle only assumes
they are present.
