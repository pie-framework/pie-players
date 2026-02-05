# Math Renderer Architecture - Changelog

**Date**: 2026-02-01
**Version**: 0.1.0

## Summary

Implemented a unified, pluggable math renderer architecture across both **pie-players** and **pie-elements-ng** projects. Both projects now use identical provider patterns for programmatic renderer switching.

## New Packages

### pie-players

1. **@pie-players/math-renderer-core** (v0.1.0)
   - Core `MathRenderer` type
   - `mathRendererProvider` singleton
   - Zero dependencies

2. **@pie-players/math-renderer-mathjax** (v0.1.0)
   - Wraps `@pie-lib/math-rendering-module`
   - Factory: `createMathjaxRenderer()`
   - Default renderer

3. **@pie-players/math-renderer-katex** (v0.1.0)
   - KaTeX implementation
   - Factory: `createKatexRenderer()`
   - ~100KB alternative to MathJax

## Updated Packages

### pie-players

- **@pie-players/pie-players-shared** (v0.1.0)
  - Added `setMathRenderer()` function
  - Updated `initializeMathRendering()` to use provider
  - Maintains window globals for PIE element compatibility

### pie-elements-ng

- **@pie-element/shared-math-rendering-core**
  - Added `mathRendererProvider` singleton
  - New `getRendererOrDefault()` helper

- **@pie-element/element-player**
  - Removed `mathRenderer` component prop
  - Now uses `mathRendererProvider.getRendererOrDefault()`
  - Consistent with pie-players approach

## API Changes

### Breaking Changes

**pie-elements-ng only:**
- ❌ Removed: `<PieElementPlayer mathRenderer={renderer} />`
- ✅ New: `mathRendererProvider.setRenderer(renderer)`

**pie-players:**
- ✅ No breaking changes - backward compatible

### New APIs

Both projects now support:

```typescript
// Set renderer programmatically
import { mathRendererProvider } from '@pie-players/math-renderer-core';
// or: '@pie-element/shared-math-rendering-core'

import { createKatexRenderer } from '@pie-players/math-renderer-katex';
// or: '@pie-element/shared-math-rendering-katex'

const renderer = await createKatexRenderer();
mathRendererProvider.setRenderer(renderer);
```

## Migration Guide

### pie-players Users

**No migration needed!** Default MathJax behavior unchanged.

**To use KaTeX:**
```typescript
import { createKatexRenderer } from '@pie-players/math-renderer-katex';
import { setMathRenderer } from '@pie-players/pie-players-shared/pie';

const renderer = await createKatexRenderer();
setMathRenderer(renderer);
```

### pie-elements-ng Users

**Previous approach (no longer works):**
```typescript
// ❌ Old way
<PieElementPlayer mathRenderer={createKatexRenderer()} />
```

**New approach:**
```typescript
// ✅ New way
import { mathRendererProvider } from '@pie-element/shared-math-rendering-core';
import { createKatexRenderer } from '@pie-element/shared-math-rendering-katex';

const renderer = createKatexRenderer();
mathRendererProvider.setRenderer(renderer);
```

## Documentation

### New Documents

1. **MATH-RENDERER-ARCHITECTURE.md** - Complete architecture documentation
2. **packages/math-renderer-core/README.md** - Core package documentation
3. **packages/math-renderer-mathjax/README.md** - MathJax adapter documentation
4. **packages/math-renderer-katex/README.md** - KaTeX adapter documentation

### Updated Documents

1. **README.md** - Added math renderer packages to package list
2. **docs/ARCHITECTURE.md** - Added Math Rendering section

## Benefits

1. **Unified API** - Both projects use identical patterns
2. **Type-Safe** - No string-based config, compile-time checking
3. **Programmatic** - Code-based renderer switching
4. **Extensible** - Easy to add custom renderers
5. **Backward Compatible** - Existing code works unchanged

## Technical Details

### Architecture Pattern

- **Provider Singleton**: Global state management
- **Factory Functions**: Type-safe renderer creation
- **Interface Segregation**: `MathRenderer` = simple function signature
- **Dependency Inversion**: Consumers depend on abstractions

### Window Globals (pie-players)

For PIE element compatibility, sets two globals:
- `window["@pie-lib/math-rendering"]`
- `window["_dll_pie_lib__math_rendering"]`

### Default Behavior

Both projects default to **MathJax** for consistency and feature completeness.

## Performance Comparison

| Renderer | Bundle Size | Render Speed | Use Case |
|----------|-------------|--------------|----------|
| MathJax | ~2.7MB | Baseline | Full features, accessibility |
| KaTeX | ~100KB | ~100x faster | Performance, small bundles |

## Future Enhancements

Potential improvements:
- Context-based rendering (different renderers per component tree)
- Lazy renderer loading
- Renderer caching
- Hot-swapping with re-render
- Usage telemetry

## Testing

- ✅ All packages build successfully
- ✅ TypeScript compilation passes
- ✅ Backward compatibility verified (pie-players)
- ✅ Element player builds with new pattern (pie-elements-ng)

## Related Issues

This implementation aligns both projects for consistency and provides a foundation for future math rendering improvements.
