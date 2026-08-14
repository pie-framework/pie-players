# @pie-players/pie-tool-theme

Accessible color scheme selection tool for PIE assessment players.

## Overview

Provides a theme/color scheme picker that applies accessible color schemes via the `<pie-theme>` provider. It is designed for the relevant WCAG 2.2 Level AA color, contrast, focus, and keyboard requirements.

## Custom Element

Tag: `pie-tool-theme`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `visible` | `boolean` | `false` | Controls visibility |
| `tool-id` | `string` | `'theme'` | Identifier used by the ToolCoordinator |

## Features

- Dropdown scheme selector with color previews
- Reads the shared `@pie-players/pie-theme` scheme catalog and updates immediately when a custom scheme is registered or unregistered
- Uses centrally derived catalog previews instead of carrying a duplicate palette; custom previews use PIE's canonical light-base resolution on a stable opaque swatch
- Retains a requested custom scheme when it is temporarily unavailable, clearly labels it as unavailable, and restores it automatically if it is registered again
- Persists selection to `localStorage` (key: `pie-color-scheme`)
- Applies scheme by setting the `scheme` attribute on the nearest `<pie-theme>` element
- Focus trap when visible; keyboard navigation with arrow keys and Escape
- Connects to `AssessmentToolkitRuntimeContext` for ToolCoordinator integration

## Integration

Registered through the `ToolRegistry` as `theme`. Managed by `ToolkitCoordinator` via `tools.placement`.

Register custom schemes globally with `registerPieColorSchemes` from `@pie-players/pie-theme`. Every mounted theme picker observes the same immutable catalog; per-element scheme catalogs are not supported.

## License

MIT
