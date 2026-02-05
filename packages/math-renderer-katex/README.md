# @pie-players/math-renderer-katex

KaTeX adapter for PIE math rendering (~100KB).

## Overview

Fast, lightweight LaTeX rendering for browsers. About 100x faster than MathJax with a much smaller bundle size (~100KB vs ~2.7MB).

## Installation

```bash
npm install @pie-players/math-renderer-katex
npm install @pie-players/math-renderer-core
```

## Usage

### With PIE Players

```typescript
import { createKatexRenderer } from '@pie-players/math-renderer-katex';
import { setMathRenderer } from '@pie-players/pie-players-shared/pie';

// Create and set renderer before loading PIE elements
const renderer = await createKatexRenderer({
  throwOnError: false,
  trust: true
});
setMathRenderer(renderer);

// Now load PIE elements - they'll use KaTeX
await loader.load(config, document, needsControllers);
```

### Standalone Usage

```typescript
import { createKatexRenderer } from '@pie-players/math-renderer-katex';

const renderer = await createKatexRenderer();

// Render math in any element
await renderer.renderMath(document.body);
```

### With Provider

```typescript
import { mathRendererProvider } from '@pie-players/math-renderer-core';
import { createKatexRenderer } from '@pie-players/math-renderer-katex';

const renderer = await createKatexRenderer();
mathRendererProvider.setRenderer(renderer);
```

## API

### `createKatexRenderer(options?)`

Creates a KaTeX renderer adapter.

**Parameters:**

```typescript
interface KatexRendererOptions {
  /** If true, render errors will be thrown as exceptions */
  throwOnError?: boolean; // default: false

  /** Color to use for rendering errors */
  errorColor?: string; // default: "#cc0000"

  /** If true, allow commands like \includegraphics */
  trust?: boolean; // default: false

  /** Automatically load KaTeX CSS */
  loadCss?: boolean; // default: true

  /** Custom KaTeX CSS URL */
  cssUrl?: string;
}
```

**Returns:** `Promise<MathRenderingAPI>`

## Features

- ✅ ~100x faster than MathJax
- ✅ ~100KB bundle size (vs ~2.7MB for MathJax)
- ✅ 95% LaTeX coverage
- ✅ Auto-loads KaTeX CSS
- ✅ MathML to LaTeX conversion
- ✅ Error fallback to raw LaTeX
- ✅ MathJax-compatible API

## Comparison: KaTeX vs MathJax

| Feature | KaTeX | MathJax |
|---------|-------|---------|
| Bundle Size | ~100KB | ~2.7MB |
| Speed | ~100x faster | Slower |
| LaTeX Coverage | 95% | 99% |
| MathML Support | Via conversion | Native |
| Accessibility | Limited | Complete |
| Best For | Performance, bundle size | Feature completeness |

## When to Use KaTeX

Choose KaTeX when:
- ✅ Bundle size matters
- ✅ Rendering speed is critical
- ✅ You're using common LaTeX commands (95% coverage)
- ✅ You don't need advanced accessibility features

Choose MathJax when:
- ✅ You need 100% LaTeX/MathML support
- ✅ Accessibility is critical (screen readers, speech output)
- ✅ Bundle size is not a concern
- ✅ You're using advanced/uncommon LaTeX commands

## Related Packages

- [@pie-players/math-renderer-core](../math-renderer-core) - Core types and provider
- [@pie-players/math-renderer-mathjax](../math-renderer-mathjax) - MathJax adapter (more features, larger)

## License

MIT
