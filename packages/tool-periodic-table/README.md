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

## Category colours

Category fills are a fixed palette, not theme tokens: they encode the data, so
their ink is pinned to match rather than inherited from `--pie-text`, which is
near-white under a dark theme.

Under a colour scheme they collapse. `--pie-fixed-hue-collapse` is `100%` there,
which folds every fill into `--pie-background-dark` and the ink back into
`--pie-text`, and takes the cell edge to `--pie-border` so a cell still reads as
a cell. Category then lives in the badge row that filters by it, the
selected-element panel that names it, and each cell's accessible name. A host
that wants the encoding kept under its own registered scheme sets
`--pie-fixed-hue-collapse: 0%` in that scheme.

## Integration

Registered through the `ToolRegistry` as `periodicTable`. Managed by `ToolkitCoordinator` via `tools.placement`.

## License

MIT
