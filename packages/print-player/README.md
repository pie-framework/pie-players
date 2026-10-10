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

By default, `@pie-element/*` packages are loaded from their browser ESM print
artifacts at `dist/browser/print/index.js`. The player uses the shared
PIE ESM loader so React and React DOM are resolved through the same import-map
policy as the other browser ESM players.

## Installation

```bash
bun add @pie-players/pie-print-player
```

## CDN Usage

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@pie-players/pie-print-player/dist/print-player.js"></script>
```

## Content styles

The player installs `@pie-players/pie-theme/components.css` at import, with the
item player's detection and ownership opt-out
([content styles](../item-player/README.md#content-styles)). Its `@media print`
rules hide `.noprint` and `.kds-noprint`. Without the stylesheet, authored
passage titles and `kds-*` markup render unstyled, and content the author marked
`.noprint` is printed rather than hidden.

## Usage

```html
<pie-print></pie-print>
<script>
  const player = document.querySelector('pie-print');
  player.config = {
    item: {
      markup: '<multiple-choice id="q1"></multiple-choice>',
      elements: { 'multiple-choice': '@pie-element/multiple-choice@<version>' },
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
| `trustMarkup` (attr `trust-markup`) | `boolean` | Render authored markup without sanitizing it. Defaults to `false` |
| `sanitizeMarkup` | `ItemMarkupSanitizer \| null` | Custom sanitizer used instead of the default. Ignored when `trustMarkup` is set |

### Markup Sanitization

Authored `item.markup` is treated as untrusted and passed through the shared
sanitizer from `@pie-players/pie-players-shared/security` before rendering,
matching `<pie-item-player>`. Scripts, event-handler attributes, unknown
protocols, and dangerous tags (`iframe`, `object`, `embed`, `form`, ...) are
stripped; the interactive element tags from `item.elements` and their print
variants are allow-listed so they survive.

Unlike the screen players, the print pipeline does **not** apply the overwide
image/table scroll wrappers: those are `overflow-x: auto` reflow affordances,
and `overflow` clips rather than scrolls in print media, which would cut off
wide content.

Set `trust-markup` only when the host has already validated the markup:

```html
<pie-print trust-markup></pie-print>
```

Both `trustMarkup` and `sanitizeMarkup` may be set before or after `config` --
the markup is reprocessed when they change.

### Config

```typescript
interface Config {
  item: Item;
  options?: {
    role?: 'student' | 'instructor';
  };
  accessibility?: PrintAccessibilityConfig;
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
    url: `https://your-cdn.example.com/@pie-element/${name}@${version}/dist/browser/print/index.js`,
    module: true
  });
};
```

## Exports

```typescript
import {
  PiePrint,
  ALTERNATES_CLASS, CONTENT_LEAD_SURFACE, mountItemAlternates,
  define, status, whenDefined,
  defaultLoadResolution, defaultResolve, hashCode,
  mkItem, printItemAndFloaters, processMarkup
} from '@pie-players/pie-print-player';

import type {
  Config, Elements, Item, Model,
  LoadResolutionFn, LoadResolutionResult,
  MissingElFn, MountedAlternates, NodeResult,
  PkgResolution, PrintAccessibilityConfig, ResolverFn
} from '@pie-players/pie-print-player';
```

## License

MIT
