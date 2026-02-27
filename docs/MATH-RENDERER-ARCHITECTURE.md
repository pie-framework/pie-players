# Math Renderer Architecture

## Status

This document is still relevant. It describes the current pluggable math-renderer
design used by `pie-players`, and how it aligns with the `pie-elements-ng`
direction.

## Overview

The math renderer system is provider-based and programmatic:

1. `MathRenderer` type contract
2. Global provider singleton (`mathRendererProvider`)
3. Adapter factories (`createMathjaxRenderer()`, `createKatexRenderer()`)
4. Runtime override API (`setMathRenderer()`)

This allows host products to pick MathJax, KaTeX, or a custom implementation
without changing player internals.

## Package Structure (pie-players)

```text
packages/
├── math-renderer-core/      # Provider + types
├── math-renderer-mathjax/   # MathJax adapter
└── math-renderer-katex/     # KaTeX adapter
```

## Runtime Integration

Main integration is in `players-shared`:

- `packages/players-shared/src/pie/math-rendering.ts`
  - `initializeMathRendering(customRenderer?)`
  - `setMathRenderer(renderer)`
  - `renderMath(element)`

`initializeMathRendering()` installs the renderer through the provider and keeps
the expected PIE globals available for bundled elements.

## Public API Patterns

### Default behavior

If no custom renderer is set, players use MathJax via
`@pie-players/math-renderer-mathjax`.

### Host override (recommended)

```typescript
import { createKatexRenderer } from "@pie-players/math-renderer-katex";
import { setMathRenderer } from "@pie-players/pie-players-shared/pie";

const renderer = await createKatexRenderer({ throwOnError: false });
setMathRenderer(renderer);
```

Set the renderer before loading item/section players so element rendering is
consistent.

### Custom renderer support

```typescript
import type { MathRenderer } from "@pie-players/math-renderer-core";
import { mathRendererProvider } from "@pie-players/math-renderer-core";

const customRenderer: MathRenderer = async (element) => {
  // custom rendering logic
};

mathRendererProvider.setRenderer(customRenderer);
```

## Why provider-based

- Keeps loader/player signatures stable
- Avoids string-based renderer config
- Enables type-safe renderer wiring
- Allows cross-app global consistency

## Cross-project note

`pie-elements-ng` has the same broad provider/factory model. The two projects
are intentionally aligned conceptually, but this document is authoritative for
`pie-players`.

## Related docs

- `docs/ARCHITECTURE.md`
- `docs/ESM-PLAYER-COMPARISON.md`
- `packages/math-renderer-core/README.md`
- `docs/CHANGELOG-MATH-RENDERER.md`
