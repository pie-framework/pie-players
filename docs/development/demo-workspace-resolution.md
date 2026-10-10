# Demo apps and workspace package resolution

Publishable `@pie-players/*` packages expose runtime code through `package.json` **`exports`** that point at built **`dist/`** files. Local development should assume the same: the demo apps load what npm clients load, not raw `src/`.

## Shared rules

- After editing a library package, either run **`bun run build`** for that package (or a filtered Turbo build), or use a package **`dev`** script such as **`vite build --watch`** so `dist/` stays current.
- Root **`bun run build:watch:section-tools`** runs Turbo watch over a curated set of section-related packages; use it when iterating on section demos and shared tools together.

## `apps/section-demos` (explicit `dist` aliases)

[`apps/section-demos/vite.config.ts`](../../apps/section-demos/vite.config.ts) maps many workspace imports to **concrete files under each package’s `dist/`** (for example tool packages). That matches **npm + Vite resolve** behavior for those entrypoints: the dev server uses the same bundled artifacts consumers get. The exception is `@pie-players/pie-section-player-tools-shared`, which it aliases to its source `index.ts`.

- **Why:** Reduces “works in monorepo dev, breaks from the registry” drift for those modules.
- **Local pie-elements-ng:** **`bun run dev:section:cdn`** serves a built pie-elements-ng checkout (`PIE_ELEMENTS_NG_PATH`, else the sibling `../pie-elements-ng`) from the dev server. `?player=esm` loads its elements from there, and under `?player=preloaded` the `@pie-element/*` imports resolve to its builds, so the pages register the checkout's version.

Packages **not** listed in that alias block still resolve through normal **`workspace:*` → `exports` → `dist/`**, so they also require an up-to-date build.

## `apps/item-demos` (exports only)

[`apps/item-demos/vite.config.ts`](../../apps/item-demos/vite.config.ts) does **not** duplicate those aliases. Resolution goes through each package’s **`exports`** field, which still targets **`dist/`**.

Behavior is the same **dist-first** contract; only the mechanism differs (no per-import Vite alias table).

## `apps/assessment-demos`

Aliases one package, `@pie-players/pie-section-player-tools-shared`, to its source `index.ts`; every other import follows **`exports`** to `dist/`.

## TTS defaults

`ToolkitCoordinator` defaults to browser TTS unless `tools.providers.textToSpeech` sets `backend: "server"`. Section demos pin the browser default (`SECTION_DEMOS_DEFAULT_TTS_TOOL_PROVIDER` in `apps/section-demos/src/lib/demo-runtime/section-demos-default-tts.ts`); the same file keeps an AWS Polly preset over the `/api/tts` proxy for targeted comparisons.

## Related scripts

| Goal | Command |
|------|--------|
| Section demo dev server | `bun run dev:section` |
| Section demo dev server with ESM elements from a local pie-elements-ng build | `bun run dev:section:cdn` |
| Specs for that path | `bun run test:e2e:section-player:local-esm-cdn` |
| Rebuild all workspace packages then section dev | `bun run dev:section -- --rebuild` |
| Watch builds for common section/tool packages | `bun run build:watch:section-tools` |
| Item demo dev | `bun run dev:item` |

See also [`docs/setup/demo_system.md`](../setup/demo_system.md) for the broader demo harness picture.
