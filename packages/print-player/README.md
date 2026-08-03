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

By default, `@pie-element/*` packages are loaded from their PIE-626 browser ESM
print artifacts at `dist/browser/print/index.js`. The player uses the shared
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

Authored content relies on shared classes that belong to no single component:
passage markup (`.numbered-paragraph`, `.p-number`, `div.passage-title` /
`-subtitle` / `-author`), the legacy `kds-*` content classes, and — load-bearing
for this player specifically — the `@media print` rules that hide `.noprint` and
`.kds-noprint`. They live in `@pie-players/pie-theme/components.css`.

**The player installs that stylesheet itself.** Importing the element is all a
host needs:

```ts
import "@pie-players/pie-print-player";
```

The stylesheet is bundled into the player as text and installed once per
document, at import time, before any instance renders. It is prepended to
`<head>` so host CSS that comes later still wins at equal specificity.
Installation is idempotent, so a page that loads both this player and
`@pie-players/pie-item-player` ends up with a single copy.

This applies to CDN hosts too: no extra `<link>` is needed.

Without it, printed output regresses in two ways: authored passage titles and
`kds-*` markup render unstyled, and content the author marked `.noprint` is
printed rather than hidden.

### Taking ownership of the stylesheet

To load it yourself instead — to control its position in your cascade, or to ship
a patched copy — declare that on the root element **before** the player script
runs:

```html
<html data-pie-content-styles="host"></html>
```

```ts
import "@pie-players/pie-theme/components.css"; // now your responsibility
```

The player then installs nothing. If no content stylesheet turns out to be
present, it logs a one-time `console.warn` naming the missing import, rather than
silently printing unstyled content. Declare `@pie-players/pie-theme` in your own
`package.json` if you go this route: it is a dependency of this package, so the
file is already on disk, but importing a subpath from a transitive dependency
breaks on a dedupe change or a move to pnpm / Yarn PnP.

This stylesheet is only the shared content styles. See
[`@pie-players/pie-theme`](../theme/README.md) for `--pie-*` tokens, the
`<pie-theme>` host element, and color-scheme / font-size theming — all optional
for correct rendering, since every `var(--pie-*)` in `components.css` has a
fallback.

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
