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

- Clear window pane inside an obscuring frame, at a host-configured opacity
- Drag anywhere on the frame to reposition
- Three controls on the frame:
  - **Close** (top right) hides the tool through `ToolCoordinator.hideTool`, which also
    deactivates its toolbar button
  - **Reading-window resize** (bottom centre) changes the pane height
  - **Frame resize** (bottom right) changes the frame band height and the overall width
- Full keyboard support:
  - On the tool: arrow keys to move, `+`/`-` to resize the reading window, `Escape` to
    close
  - On the reading-window handle: up/down arrows change the pane height
  - On the frame handle: up/down arrows change the frame band height, left/right arrows
    change the width
- Every drag has a keyboard equivalent (WCAG 2.5.7) and controls meet the 24x24 minimum
  target size (WCAG 2.5.8)
- Screen reader announcements for all state changes
- Connects to `AssessmentToolkitRuntimeContext` for ToolCoordinator integration

## Configuration

How the frame masks the page — its fill and how strongly it obscures — is a host
setting, not a student one. It trades reading focus against how much surrounding
context a test taker can still see, which is a call a programme makes for its whole
population, so it is configured once per deployment rather than adjusted mid-test.

```css
:root {
  /* Masking strength; the pane is always fully transparent. */
  --pie-tool-line-reader-frame-opacity: 0.65;
  /* Fill of the obscuring frame. */
  --pie-tool-line-reader-frame-color: #10233b;
}
```

| Custom property | Default | Description |
|---|---|---|
| `--pie-tool-line-reader-frame-opacity` | `0.8` | Masking strength of the frame |
| `--pie-tool-line-reader-frame-color` | `#000` | Fill of the obscuring frame |
| `--pie-tool-line-reader-control-color` | `#fff` | Glyph colour of the close and resize controls |

All three are `component-public` entries in
`packages/theme/src/token-registry.json` and are safe for a host to rely on. The
component only reads them — it never writes them inline — so a plain host
declaration wins without `!important`.

Two constraints come with overriding them. Lowering the opacity weakens the masking
the tool exists to provide, and there is no in-session control for a student to
recover from a value that masks too little, so check any override against the
schemes you ship (see [Colour schemes](#colour-schemes) for the figures the
defaults produce). And `--pie-tool-line-reader-control-color` is a companion to the
fill rather than a hook worth setting alone: the control glyphs sit on the frame and
default to white to pair with a dark scrim, so a light fill needs a new glyph colour
with it, keeping 3:1 against the fill (WCAG 2.2 SC 1.4.11). The controls stay fully
opaque whatever the frame opacity is, so the fill alone decides that ratio.

## Colour schemes

The frame stays a dark scrim in every PIE colour scheme instead of following
`--pie-text`. Masking works by collapsing the contrast of whatever it covers, and
an ink-coloured scrim defeats that on its own scheme — a yellow scrim over
`yellow-on-blue` text hides nothing, and a white one glares in a dark scheme the
reader chose to avoid glare. Dimming works in both directions: at the default fill
and opacity, across all six built-in schemes the covered text drops from
10.9–19.3:1 down to 1.09–1.71:1.

What does follow the scheme is the boundary. On a light page the dark scrim shows
its own edge against the background (11.7–17.6:1), but on a dark page it blends in,
so `--pie-tool-line-reader-outline-color` draws an ink hairline that reads against
the scrim (7.6–9.8:1 in the dark schemes). The drop shadow is ink-derived for the
same reason, becoming a soft halo rather than disappearing.

Because the fill is a deployment setting rather than a scheme-derived one, a host
that overrides it owns these numbers for the schemes it ships.

## Theming

The remaining custom properties are package-private, not part of the registered
host token contract: they are read as `var(--x, fallback)` (or set inline by the
component, for the geometry ones), so a host can override them, but they carry no
compatibility guarantee and may change with the tool's internals. Prefer the
semantic tokens they derive from.

| Custom property | Default | Description |
|---|---|---|
| `--pie-tool-line-reader-outline-color` | `--pie-text` at 70% | Hairline marking the window boundary |

## Integration

Registered through the `ToolRegistry` as `lineReader`. Managed by `ToolkitCoordinator` via `tools.placement`.

## License

MIT
