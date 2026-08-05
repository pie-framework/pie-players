# @pie-players/pie-tool-line-reader

Draggable reading guide overlay tool for PIE assessment players.

## Overview

Provides a movable, resizable reading window that helps students focus on specific lines of text during assessments.

The tool renders as a "window": a fully transparent **pane** through which the underlying page content is visible unchanged, surrounded on all four edges by an obscuring **frame** (black at 80% opacity by default) that largely hides the neighbouring lines. The frame starts as a 48px band above and below the pane and a 12px edge to its left and right.

## Custom Element

Tag: `pie-tool-line-reader`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `visible` | `boolean` | `false` | Controls visibility |
| `tool-id` | `string` | `'lineReader'` | Identifier used by the ToolCoordinator |

## Features

- Clear window pane inside an obscuring frame; adjustable frame opacity
- Drag anywhere on the frame to reposition
- Three controls on the frame:
  - **Close** (top right) hides the tool through `ToolCoordinator.hideTool`, which also
    deactivates its toolbar button
  - **Reading-window resize** (bottom centre) changes the pane height
  - **Frame resize** (bottom right) changes the frame band height and the overall width
- Full keyboard support:
  - On the tool: arrow keys to move, `+`/`-` to resize the reading window, `[`/`]` to
    adjust frame opacity, `Escape` to close
  - On the reading-window handle: up/down arrows change the pane height
  - On the frame handle: up/down arrows change the frame band height, left/right arrows
    change the width
- Every drag has a keyboard equivalent (WCAG 2.5.7) and controls meet the 24x24 minimum
  target size (WCAG 2.5.8)
- Screen reader announcements for all state changes
- Connects to `AssessmentToolkitRuntimeContext` for ToolCoordinator integration

## Theming

These are package-private custom properties, not part of the registered host
token contract in `packages/theme/src/token-registry.json`: they are read as
`var(--x, fallback)` (or set inline by the component, for the geometry ones), so
a host can override them, but they carry no compatibility guarantee and may
change with the tool's internals. Prefer the semantic tokens they derive from.

| Custom property | Default | Description |
|---|---|---|
| `--pie-tool-line-reader-frame-color` | `#000` | Fill of the obscuring frame |
| `--pie-tool-line-reader-frame-opacity` | `0.8` | Frame opacity; the pane is always fully transparent |
| `--pie-tool-line-reader-outline-color` | `--pie-text` at 70% | Hairline marking the window boundary |
| `--pie-tool-line-reader-control-color` | `#fff` | Glyph colour of the close and resize controls |

The frame opacity custom property is set inline by the component from its current
state, so host overrides need `!important` (or a higher-specificity rule) to win.
The controls sit on top of the frame rather than inside it, so they stay fully
opaque whatever the frame opacity is.

### Colour schemes

The frame stays a dark scrim in every PIE colour scheme instead of following
`--pie-text`. Masking works by collapsing the contrast of whatever it covers, and
an ink-coloured scrim defeats that on its own scheme — a yellow scrim over
`yellow-on-blue` text hides nothing, and a white one glares in a dark scheme the
reader chose to avoid glare. Dimming works in both directions: across all six
built-in schemes the covered text drops from 10.9–19.3:1 down to 1.09–1.71:1.

What does follow the scheme is the boundary. On a light page the dark scrim shows
its own edge against the background (11.7–17.6:1), but on a dark page it blends in,
so `--pie-tool-line-reader-outline-color` draws an ink hairline that reads against
the scrim (7.6–9.8:1 in the dark schemes). The drop shadow is ink-derived for the
same reason, becoming a soft halo rather than disappearing.

Overriding `--pie-tool-line-reader-frame-color` to a light fill means overriding
`--pie-tool-line-reader-control-color` too — the glyphs are white to pair with the
dark scrim, not with the page.

## Integration

Registered through the `ToolRegistry` as `lineReader`. Managed by `ToolkitCoordinator` via `tools.placement`.

## License

MIT
