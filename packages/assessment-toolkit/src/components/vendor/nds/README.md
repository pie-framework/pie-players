# Vendored: `nds-icon-button`

Pre-built bundle of the Renaissance Next Design System (NDS)
`<nds-icon-button>` custom element. Used by `ItemToolBar.svelte` for the
calculator shell header (chevrons, zoom, close) so the toolkit matches the
Knowledge-Check Figma without taking a runtime dependency on Lit or the rest
of NDS.

## Provenance

| Field | Value |
| --- | --- |
| Upstream repo | `git@github.com:RenaissancePlace/nextComponentLibrary.git` |
| Source file | `web-components/src/components/icon-button/nds-icon-button.ts` |
| Last sync commit | `1c728d3` (`feat(UX-2319): add new components…`) |
| Bundler | Vite 7 in lib mode, ES output, single-file (Lit inlined) |

## Why a vendored bundle, not an npm dep

NDS is not currently published to a registry the `@pie-players/*` chain can
consume. Copying the `.ts` source directly (the path the NDS docs suggest)
would force `@pie-players/pie-assessment-toolkit` to take a `lit` dependency
and pull in a chunk of foundations CSS, both of which would leak to every
downstream consumer on lockstep release. A pre-built single-file bundle
sidesteps both: zero new package deps, the bundle inlines what it needs, and
the toolkit's CE build inlines this file into the published artifact.

## How to refresh

When a newer `nds-icon-button` is needed:

1. Pull the latest `nextComponentLibrary` next to this repo (sibling
   checkout: `../../nextComponentLibrary`).
2. From `nextComponentLibrary/web-components/`, `bun install`.
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
4. Copy the output:
   ```bash
   cp NDS-Prototypes/dist-bundles-self-contained/nds-icon-button.bundled.js \
      ../../pie-players/packages/assessment-toolkit/src/components/vendor/nds/nds-icon-button.js
   ```
5. Update the `Last sync commit` row above with the new upstream SHA.
6. From `packages/assessment-toolkit`, run `bun run build` and verify the
   calculator shell still mounts and the buttons still register.

## Build-time mutation

`scripts/build-ce-components.mjs` does **not** copy this file verbatim. It
rewrites every `customElements.define(IDENT, IDENT)` call into
`customElements.get(IDENT) || customElements.define(IDENT, IDENT)` while
mirroring `src/components/vendor/` → `dist/components/vendor/`.

This is required because the toolkit produces three CE bundles
(`ItemToolBar`, `SectionToolBar`, `PieAssessmentToolkit`), each of which
inlines this file via `bun build`. A host page that loads more than one of
those bundles would otherwise hit a duplicate-define `NotSupportedError`
when the second bundle's `nds-icon-button` register call fires.

If a future vendored bundle uses a different define call shape (e.g.
`customElements.define("literal-tag", Ctor)` or via an alias), the regex in
`build-ce-components.mjs` will silently miss it. Re-test by loading the
`PieAssessmentToolkit` and `ItemToolBar` CEs on the same page after a refresh.

## Runtime dependencies

The bundle's `connectedCallback` injects a `<link>` for the Renaissance
Roboto stylesheet. The toolkit pre-injects a CORS-clean Roboto from Google
Fonts before the first `<nds-icon-button>` mounts so the bundle's
`link[href*="Roboto"]` guard short-circuits.

The bundle's `render()` emits `fa-light fa-${iconName}` classes for icons.
Light is FontAwesome 6 **Pro** (commercial license). The toolkit loads:

1. FA Free from jsDelivr as a same-origin-friendly fallback.
2. FA Pro from `/_fa-pro/{fontawesome,light}.min.css` if the host exposes
   that path. `apps/section-demos/vite.config.ts` proxies `/_fa-pro/*` →
   `https://ui.renaissance.com/fonts/Font_Awesome_6_Pro/*`. Hosts without
   the proxy fall through to FA Free's Solid weight (thicker stroke than
   the design intends, but legible).

## Linting / formatting

This folder is excluded from `biome` checks via `biome.json`. The
`check-ce-define-safety` script allowlists this exact file because the
upstream Lit decorator emits a raw `customElements.define`; safety is
recovered at build time by the rewrite described above.
