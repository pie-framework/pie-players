# Demo apps and workspace package resolution

Publishable `@pie-players/*` packages expose runtime code through `package.json` **`exports`** that point at built **`dist/`** files. Local development should assume the same: the demo apps load what npm clients load, not raw `src/`.

## Shared rules

- After editing a library package, either run **`bun run build`** for that package (or a filtered Turbo build), or use a package **`dev`** script such as **`vite build --watch`** so `dist/` stays current.
- Root **`bun run build:watch:section-tools`** runs Turbo watch over a curated set of section-related packages; use it when iterating on section demos and shared tools together.

## `apps/section-demos` (explicit `dist` aliases)

[`apps/section-demos/vite.config.ts`](../../apps/section-demos/vite.config.ts) maps many workspace imports to **concrete files under each package’s `dist/`** (for example tool packages). That matches **npm + Vite resolve** behavior for those entrypoints: the dev server uses the same bundled artifacts consumers get.

- **Why:** Reduces “works in monorepo dev, breaks from the registry” drift for those modules.
- **Optional:** With **`LOCAL_ESM_CDN=true`**, the config can load the local ESM CDN plugin for **production-like** CDN-style loading (see comments in the same file).

Packages **not** listed in that alias block still resolve through normal **`workspace:*` → `exports` → `dist/`**, so they also require an up-to-date build.

## `apps/item-demos` (exports only)

[`apps/item-demos/vite.config.ts`](../../apps/item-demos/vite.config.ts) does **not** duplicate those aliases. Resolution goes through each package’s **`exports`** field, which still targets **`dist/`**.

Behavior is the same **dist-first** contract; only the mechanism differs (no per-import Vite alias table).

## `apps/assessment-demos`

Uses a **small** set of explicit `dist` aliases where needed (see its `vite.config.ts`); the rest follows **`exports`**.

## TTS defaults (Polly)

`ToolkitCoordinator` defaults to **browser** TTS unless `tools.providers.tts` sets a server backend. Section-demos merges a shared **AWS Polly** preset (`apps/section-demos/src/lib/demo-runtime/section-demos-default-tts.ts`) into each demo’s `toolkitToolsConfig` so playback and the TTS settings panel default to **`/api/tts`** (Polly) instead of Web Speech.

## Related scripts

| Goal | Command |
|------|--------|
| Section demo dev server | `bun run dev:section` |
| Rebuild all workspace packages then section dev | `bun run dev:section -- --rebuild` |
| Watch builds for common section/tool packages | `bun run build:watch:section-tools` |
| Item demo dev | `bun run dev:item` |

See also [`docs/setup/demo_system.md`](../setup/demo_system.md) for the broader demo harness picture.
