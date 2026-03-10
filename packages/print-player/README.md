# @pie-players/pie-print-player

A web component that dynamically loads and renders PIE (Platform Independent Elements) in print-friendly mode.

## Overview

The print player is a specialized, non-interactive version of the PIE element player. It:

- Dynamically loads print modules from CDN or custom URLs
- Registers print-specific custom elements with unique hash-based tag names
- Transforms interactive element markup into print-friendly versions
- Handles both embedded elements (in markup) and floater elements (like rubrics)
- Provides graceful fallbacks for missing or failed elements

Built with Lit 3.x and modern ESM architecture.

## Installation

```bash
bun add @pie-players/pie-print-player
```

## CDN Usage

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@pie-players/pie-print-player/dist/print-player.js"></script>
```

## Usage

```html
<pie-print></pie-print>
<script>
  const player = document.querySelector('pie-print');
  player.config = {
    item: {
      markup: '<multiple-choice id="q1"></multiple-choice>',
      elements: { 'multiple-choice': '@pie-element/multiple-choice@12.0.0' },
      models: [{ id: 'q1', element: 'multiple-choice', prompt: '...', choices: [...] }]
    },
    options: { role: 'student' }
  };
</script>
```

## API

### `<pie-print>` Custom Element

| Property | Type | Description |
|---|---|---|
| `config` | `Config` | Item configuration with markup, elements map, models array, and rendering options |
| `resolve` | `ResolverFn` | Custom resolver function for determining element URLs (overrides default CDN resolution) |
| `missingElement` | `MissingElFn` | Custom factory for placeholder elements shown when a print module fails to load |

### Config

```typescript
interface Config {
  item: Item;
  options?: {
    role?: 'student' | 'instructor';
  };
}

interface Item {
  markup: string;           // HTML with element placeholders
  elements: Elements;       // Tag name -> package@version map
  models: Model[];          // Data for each element instance
}
```

The `role` option controls rendering:
- `student` -- shows prompts and choices, hides correct answers and rationales
- `instructor` -- shows correct answers highlighted and rationales

### Custom Resolution

Override the default CDN resolver to control where print modules are loaded from:

```javascript
player.resolve = (tagName, pkg) => {
  const [_, name, version] = pkg.match(/@pie-element\/(.*?)@(.*)/);
  return Promise.resolve({
    tagName,
    pkg,
    url: `https://your-cdn.example.com/@pie-element/${name}@${version}/dist/print/index.js`,
    module: true
  });
};
```

## Exports

```typescript
import {
  PiePrint,
  define, status, whenDefined,
  defaultLoadResolution, defaultResolve, hashCode,
  mkItem, printItemAndFloaters, processMarkup
} from '@pie-players/pie-print-player';

import type {
  Config, Elements, Item, Model,
  LoadResolutionFn, LoadResolutionResult,
  MissingElFn, NodeResult,
  PkgResolution, ResolverFn
} from '@pie-players/pie-print-player';
```

## License

MIT
