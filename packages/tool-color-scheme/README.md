# @pie-players/pie-tool-theme

Accessible color scheme selection tool for PIE assessment players.

## Overview

Provides a theme/color scheme picker that applies accessible color schemes via the `<pie-theme>` provider. Addresses WCAG 2.1 Level AA criteria 1.4.1, 1.4.3, and 1.4.11.

## Custom Element

Tag: `pie-tool-theme`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `visible` | `boolean` | `false` | Controls visibility |
| `tool-id` | `string` | `'theme'` | Identifier used by the ToolCoordinator |
| `schemes` | `string` | `''` | JSON string of custom scheme definitions |

| JS Property | Type | Description |
|---|---|---|
| `schemeCatalog` | `object[]` | Array of scheme objects (alternative to the `schemes` attribute) |

## Features

- Dropdown scheme selector with color previews
- Discovers available schemes from `<pie-theme>` provider, `schemeCatalog` property, or `schemes` JSON attribute
- Persists selection to `localStorage` (key: `pie-color-scheme`)
- Applies scheme by setting the `scheme` attribute on the nearest `<pie-theme>` element
- Focus trap when visible; keyboard navigation with arrow keys and Escape
- Connects to `AssessmentToolkitRuntimeContext` for ToolCoordinator integration

## Integration

Registered through the `ToolRegistry` as `theme`. Managed by `ToolkitCoordinator` via `tools.placement`.

## License

MIT
