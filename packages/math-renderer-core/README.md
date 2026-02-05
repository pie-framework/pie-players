# @pie-players/math-renderer-core

Core types and provider for pluggable math rendering in PIE players.

## Overview

This package provides the foundation for pluggable math rendering. Actual rendering is done by adapter packages:

- **@pie-players/math-renderer-mathjax** - Full-featured MathJax renderer (~2.7MB)
- **@pie-players/math-renderer-katex** - Fast, lightweight KaTeX renderer (~100KB)

## Installation

```bash
npm install @pie-players/math-renderer-core
# Also install an adapter:
npm install @pie-players/math-renderer-mathjax
# or
npm install @pie-players/math-renderer-katex
```

## Usage

### Basic Usage with Provider

```typescript
import { mathRendererProvider } from '@pie-players/math-renderer-core';
import { createMathjaxRenderer } from '@pie-players/math-renderer-mathjax';

// Set the global renderer
const renderer = await createMathjaxRenderer();
mathRendererProvider.setRenderer(renderer);

// Later, get the renderer
const current = mathRendererProvider.getRenderer();
if (current) {
  await current.renderMath(document.body);
}
```

### Creating Custom Renderers

```typescript
import type { MathRenderer } from '@pie-players/math-renderer-core';

const customRenderer: MathRenderer = async (element) => {
  // Find math elements
  const mathElements = element.querySelectorAll('[data-latex]');

  // Render each element
  mathElements.forEach(el => {
    const latex = el.getAttribute('data-latex');
    // ... your rendering logic
  });
};

// Use with provider
mathRendererProvider.setRenderer(customRenderer);
```

## API

### Types

#### `MathRenderer`

```typescript
type MathRenderer = (element: HTMLElement) => void | Promise<void>;
```

Function that renders math within an HTML element.

#### `MathRenderingAPI`

```typescript
interface MathRenderingAPI {
  renderMath: MathRenderer;
  wrapMath?: (latex: string) => string;
  unWrapMath?: (wrapped: string) => string;
  mmlToLatex?: (mathml: string) => string;
}
```

Complete API that PIE elements expect on window globals.

### Provider

#### `mathRendererProvider`

Global singleton for managing the active math renderer.

**Methods:**

- `setRenderer(renderer: MathRenderingAPI): void` - Set the active renderer
- `getRenderer(): MathRenderingAPI | null` - Get the current renderer
- `isInitialized(): boolean` - Check if a renderer is set

## Architecture

See [MATH-RENDERER-ARCHITECTURE.md](../../MATH-RENDERER-ARCHITECTURE.md) for the complete unified architecture documentation.

## License

MIT
