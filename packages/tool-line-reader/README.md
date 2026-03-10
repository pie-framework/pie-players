# @pie-players/pie-tool-line-reader

Draggable reading guide overlay tool for PIE assessment players.

## Overview

Provides a movable, resizable colored overlay strip that helps students focus on specific lines of text during assessments. Supports both highlight mode (colored strip) and obscure/masking mode (darkens everything except the reading window).

## Custom Element

Tag: `pie-tool-line-reader`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `visible` | `boolean` | `false` | Controls visibility |
| `tool-id` | `string` | `'lineReader'` | Identifier used by the ToolCoordinator |

## Features

- Drag to reposition; bottom handle to resize height
- Two modes: **highlight** (colored overlay) and **obscure** (masks surrounding content)
- Five color options (yellow, blue, pink, green, orange) with adjustable opacity
- Full keyboard support:
  - Arrow keys to move
  - `+`/`-` to resize height
  - `C` to cycle colors
  - `[`/`]` to adjust opacity
  - `M` to toggle highlight/masking mode
- Screen reader announcements for all state changes
- Connects to `AssessmentToolkitRuntimeContext` for ToolCoordinator integration

## Integration

Registered through the `ToolRegistry` as `lineReader`. Managed by `ToolkitCoordinator` via `tools.placement`.

## License

MIT
