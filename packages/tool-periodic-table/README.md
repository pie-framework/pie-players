# @pie-players/pie-tool-periodic-table

Interactive periodic table reference tool for PIE assessment players.

## Overview

Provides a full periodic table with element details, category filtering, and keyboard navigation. Rendered as a custom element with shadow DOM.

## Custom Element

Tag: `pie-tool-periodic-table`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `visible` | `boolean` | `false` | Controls visibility |
| `tool-id` | `string` | `'periodicTable'` | Identifier used by the ToolCoordinator |

## Features

- Full 118-element periodic table laid out on an 18x10 CSS grid
- Element detail panel showing symbol, name, atomic mass, atomic number, electron configuration, and phase
- Category filter badges (Alkali Metal, Transition Metal, Noble Gas, etc.)
- Category-based color coding
- Keyboard accessible: focusable cells with Enter/Space to select

## Integration

Registered through the `ToolRegistry` as `periodicTable`. Managed by `ToolkitCoordinator` via `tools.placement`.

## License

MIT
