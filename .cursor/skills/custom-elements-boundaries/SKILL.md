---
name: custom-elements-boundaries
description: Enforce custom-element import and packaging boundaries. Use when adding or reviewing CE registration entrypoints, package `exports`, consumer imports of `@pie-players/*` components, `?customElement` imports, split-panel scrolling layouts, or `pie-*` class-name hygiene. Trigger on cues like "custom element", "import @pie-players", "?customElement", "register element", "package exports", "split panel", "shadow none", "light DOM".
---

# Custom Element Import Boundaries

Canonical rule: [`.cursor/rules/custom-elements-boundaries.mdc`](../../../.cursor/rules/custom-elements-boundaries.mdc).
Reference layout (canonical split-panel): [`packages/section-player/src/components/layouts/SplitPanelLayout.svelte`](../../../packages/section-player/src/components/layouts/SplitPanelLayout.svelte).

## Why this exists

Consumers of this monorepo (apps and other packages) load PIE custom
elements through built `dist` entrypoints. Importing package `src` or
crossing the `?customElement` boundary leaks build-time concerns into
consumers and produces stale-`dist` failure modes that look like runtime
bugs.

Light-DOM custom elements (`shadow: "none"`) expose their class names to the
host page; generic class names like `header` / `content` / `container`
collide with host CSS. The `pie-*` / `data-pie-*` prefix is the public
integration surface.

## Do not

- Import package source paths in consumers
  (`@pie-players/<pkg>/src/...`).
- Use cross-package `?customElement` imports.
- Import raw `*.svelte` files from another package; use the package's
  registration entrypoint instead (e.g.
  `@pie-players/pie-assessment-toolkit/components/item-toolbar-element`).
- Use generic class names (`header`, `content`, `container`, `card`, `pane`,
  `toolbar`, `body`, `active`) in custom-element markup or styles.
- Depend on host/global utility class names from inside a light-DOM CE.
- Point package `exports` at `src/...` runtime targets unless there is an
  explicit, documented exception.
- Add broad responsive overrides that switch pane `overflow` to `visible`
  without verifying both passage and item scrolling continue to work.

## Do

- In consuming apps/packages, import CE registration entrypoints (the
  `*-element.ts` / `*-element.js` files exported from package `exports`).
- Use `pie-*` or `data-pie-*` for DOM hooks and CSS selectors. For light-DOM
  CEs, treat these as public API and keep them stable.
- For `*.svelte?customElement` imports in registration entries, ensure the
  referenced `.svelte` files are reachable from publish/build output.
- After changing package `src`, **rebuild that package** before validating in
  a consumer app. Stale `dist/` is the most common false-bug source here
  (see the `build-before-tests` skill).
- For split-panel scrolling, mirror the
  [`SplitPanelLayout.svelte`](../../../packages/section-player/src/components/layouts/SplitPanelLayout.svelte)
  constraints unless intentionally redesigning:
  - Parent layout containers: `height: 100%`, `max-height: 100%`,
    `min-height: 0`, `overflow: hidden`.
  - Split grid: include `grid-template-rows: minmax(0, 1fr)`; remain
    height-constrained.
  - Scrollable panes: `overflow-y: auto`, `overflow-x: hidden`,
    `min-height: 0`, `min-width: 0`, `max-height: 100%`,
    `overscroll-behavior: contain`.

## Pre-flight checks

Run before finalizing CE-related changes:

```bash
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

These guards also enforce that no `.svelte` imports survive in published
`dist` JS, and that consumer paths never reach into `src/`.

## Related skills

- `pie-element-versioning` — for tag-name and `id` contract.
- `ce-package-packaging` — for the workflow of adding or modifying a CE
  package.
- `build-before-tests` — for the rebuild-then-test discipline.
