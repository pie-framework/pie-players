# Unified Math Renderer Architecture

## Overview

Both **pie-players** and **pie-elements-ng** now use a **unified, programmatic provider pattern** for pluggable math rendering. This allows seamless switching between MathJax, KaTeX, or custom renderers across both projects.

## Architecture

### Core Pattern

Both projects implement the same architecture:

1. **`MathRenderer` type**: `(element: HTMLElement) => void | Promise<void>`
2. **Provider singleton**: `mathRendererProvider` manages the active renderer globally
3. **Factory functions**: `createMathjaxRenderer()`, `createKatexRenderer()`
4. **Programmatic API**: No string-based configuration

### Package Structure

#### pie-players
```
packages/
├── math-renderer-core/           # Core types + provider
├── math-renderer-mathjax/        # MathJax adapter
└── math-renderer-katex/          # KaTeX adapter
```

#### pie-elements-ng
```
packages/shared/
├── math-rendering-core/          # Core types + provider
├── math-rendering-mathjax/       # MathJax adapter
└── math-rendering-katex/         # KaTeX adapter
```

## Unified API

### Setting the Renderer (Both Projects)

```typescript
// Import the factory and provider
import { createKatexRenderer } from '@pie-players/math-renderer-katex'; // or @pie-element/...
import { mathRendererProvider } from '@pie-players/math-renderer-core'; // or @pie-element/...

// Create and set the renderer
const katexRenderer = await createKatexRenderer({ throwOnError: false });
mathRendererProvider.setRenderer(katexRenderer);

// Now all math rendering uses KaTeX
```

### Default Behavior (Both Projects)

If no renderer is set, both projects default to **MathJax** for consistency.

## Usage Examples

### pie-players

```typescript
import { createKatexRenderer } from '@pie-players/math-renderer-katex';
import { setMathRenderer } from '@pie-players/pie-players-shared/pie';

// Set KaTeX BEFORE loading PIE elements
const katexRenderer = await createKatexRenderer();
setMathRenderer(katexRenderer);

// Now load PIE elements - they'll use KaTeX
await loader.load(config, document, needsControllers);
```

**Why provider pattern?** pie-players uses loaders called from many places - changing loader signatures would break backward compatibility.

### pie-elements-ng

```typescript
import { createKatexRenderer } from '@pie-element/shared-math-rendering-katex';
import { mathRendererProvider } from '@pie-element/shared-math-rendering-core';

// Set renderer globally
const katexRenderer = createKatexRenderer();
mathRendererProvider.setRenderer(katexRenderer);

// PieElementPlayer now uses KaTeX automatically
```

**Previous approach (removed):** Passing `mathRenderer` as component prop. This was component-specific and not consistent with pie-players.

## Key Benefits

### 1. **Consistency Across Projects**
- Same `MathRenderer` interface
- Same factory functions
- Same provider pattern
- Same programmatic API

### 2. **No String-Based Config**
- Type-safe renderer switching
- Compile-time checks
- IDE autocomplete

### 3. **Flexible & Extensible**
- Easy to add new renderers
- Custom renderers supported
- Runtime switching possible

### 4. **Zero Breaking Changes**
- Default MathJax behavior unchanged
- Existing code works without modification
- Opt-in migration only

## Comparison Table

| Aspect | pie-players | pie-elements-ng |
|--------|-------------|-----------------|
| **Renderer Type** | `MathRenderer` | `MathRenderer` ✅ |
| **Provider** | `mathRendererProvider` | `mathRendererProvider` ✅ |
| **Factory Functions** | `createMathjaxRenderer()`, `createKatexRenderer()` | `createMathjaxRenderer()`, `createKatexRenderer()` ✅ |
| **Override Method** | `setMathRenderer()` or provider | `mathRendererProvider.setRenderer()` ✅ |
| **Default** | MathJax | MathJax ✅ |
| **Scope** | Global (application) | Global (application) ✅ |

## Custom Renderers

Both projects support custom renderers with identical signatures:

```typescript
import type { MathRenderer } from '@pie-players/math-renderer-core';
// or: import type { MathRenderer } from '@pie-element/shared-math-rendering-core';

const customRenderer: MathRenderer = async (element) => {
  // Custom rendering logic
  const mathElements = element.querySelectorAll('[data-latex]');
  mathElements.forEach(el => {
    // ... your rendering code
  });
};

mathRendererProvider.setRenderer(customRenderer);
```

## Implementation Details

### pie-players Implementation

**Modified Files:**
- `packages/players-shared/src/pie/math-rendering.ts` - Uses provider
- `packages/players-shared/src/shims.d.ts` - Typed window globals

**New Packages:**
- `@pie-players/math-renderer-core` - Core types + provider
- `@pie-players/math-renderer-mathjax` - MathJax adapter
- `@pie-players/math-renderer-katex` - KaTeX adapter

### pie-elements-ng Implementation

**Modified Files:**
- `packages/shared/math-rendering-core/src/provider.ts` - Added provider
- `packages/shared/math-rendering-core/src/index.ts` - Export provider
- `packages/element-player/src/PieElementPlayer.svelte` - Use provider instead of props

**Changes:**
- Removed `mathRenderer` prop from `PieElementPlayer`
- Element player now uses `mathRendererProvider.getRendererOrDefault()`

## Migration Guide

### For pie-players Users

**No migration needed!** Default MathJax behavior unchanged.

**To use KaTeX:**
```typescript
import { createKatexRenderer } from '@pie-players/math-renderer-katex';
import { setMathRenderer } from '@pie-players/pie-players-shared/pie';

const renderer = await createKatexRenderer();
setMathRenderer(renderer);
```

### For pie-elements-ng Users

**No migration needed!** Default MathJax behavior unchanged.

**To use KaTeX:**
```typescript
import { createKatexRenderer } from '@pie-element/shared-math-rendering-katex';
import { mathRendererProvider } from '@pie-element/shared-math-rendering-core';

const renderer = createKatexRenderer();
mathRendererProvider.setRenderer(renderer);
```

**Previous prop-based approach (no longer supported):**
```typescript
// ❌ Old way (removed)
<PieElementPlayer mathRenderer={createKatexRenderer()} />

// ✅ New way
import { mathRendererProvider } from '@pie-element/shared-math-rendering-core';
mathRendererProvider.setRenderer(createKatexRenderer());
```

## Future Enhancements

Potential future improvements:

1. **Context-based rendering** - Different renderers per component tree
2. **Lazy renderer loading** - Load renderer only when first math element detected
3. **Renderer caching** - Cache rendered results for performance
4. **Renderer hot-swapping** - Switch renderers at runtime and re-render
5. **Renderer telemetry** - Track renderer usage and performance

## Conclusion

Both projects now have a **unified, programmatic math rendering architecture** that:
- ✅ Uses the same interfaces and patterns
- ✅ Provides type-safe, compile-time checked APIs
- ✅ Maintains backward compatibility
- ✅ Supports easy renderer switching
- ✅ Enables custom renderer implementations

This ensures consistency across the PIE ecosystem while maintaining flexibility and extensibility.
