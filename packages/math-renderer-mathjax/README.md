# @pie-players/math-renderer-mathjax

MathJax adapter for PIE math rendering (~2.7MB).

## Overview

Full-featured LaTeX and MathML rendering with accessibility support. This adapter wraps the upstream `@pie-lib/math-rendering-module` package.

## Installation

```bash
npm install @pie-players/math-renderer-mathjax
npm install @pie-players/math-renderer-core
```

## Usage

### With PIE Players

```typescript
import { createMathjaxRenderer } from '@pie-players/math-renderer-mathjax';
import { setMathRenderer } from '@pie-players/pie-players-shared/pie';

// Create and set renderer before loading PIE elements
const renderer = await createMathjaxRenderer({
  accessibility: true
});
setMathRenderer(renderer);

// Now load PIE elements - they'll use MathJax
await loader.load(config, document, needsControllers);
```

### Standalone Usage

```typescript
import { createMathjaxRenderer } from '@pie-players/math-renderer-mathjax';

const renderer = await createMathjaxRenderer();

// Render math in any element
await renderer.renderMath(document.body);
```

### With Provider

```typescript
import { mathRendererProvider } from '@pie-players/math-renderer-core';
import { createMathjaxRenderer } from '@pie-players/math-renderer-mathjax';

const renderer = await createMathjaxRenderer();
mathRendererProvider.setRenderer(renderer);
```

## API

### `createMathjaxRenderer(options?)`

Creates a MathJax renderer adapter.

**Parameters:**

```typescript
interface MathjaxRendererOptions {
  /** Enable accessibility features (speech output, etc.) */
  accessibility?: boolean;

  /** Auto-load MathJax fonts */
  loadFonts?: boolean;
}
```

**Returns:** `Promise<MathRenderingAPI>`

## Features

- ✅ Full LaTeX support
- ✅ Complete MathML support
- ✅ Accessibility features (speech output, aria-labels)
- ✅ Auto-handles delimiters natively
- ✅ Server-side rendering compatible (with proper setup)
- ✅ ~2.7MB bundle size

## Comparison: MathJax vs KaTeX

| Feature | MathJax | KaTeX |
|---------|---------|-------|
| Bundle Size | ~2.7MB | ~100KB |
| Speed | Slower | ~100x faster |
| LaTeX Coverage | 99% | 95% |
| MathML Support | Complete | Via conversion |
| Accessibility | Built-in | Limited |

## Related Packages

- [@pie-players/math-renderer-core](../math-renderer-core) - Core types and provider
- [@pie-players/math-renderer-katex](../math-renderer-katex) - KaTeX adapter (faster, smaller)

## License

MIT
