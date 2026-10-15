# @pie-players/pie-tool-magnifier

Magnifying lens tool for PIE assessment players.

## Overview

A movable, resizable lens that shows the content under it enlarged. The lens is a
window with a bar on top: zoom out, the current zoom, zoom in, and close. Its
viewport shows a scaled copy of the page around the point beneath the lens, so
moving the lens moves what it magnifies. The shown point travels the lens's block
in step with the lens, so at the block's edges the view reaches the edge content
the lens stops short of.

The tool serves the AfA PNP 3.0 `magnification` support. Its tool id is that term,
`magnification`.

## Custom Element

Tag: `pie-tool-magnifier`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `visible` | `boolean` | `false` | Controls visibility |
| `tool-id` | `string` | `'magnification'` | Identifier used by the ToolCoordinator |
| `zoom` | `number` | `2` | Starting magnification, 2 meaning twice the size. Clamped to 1.25–6; a value of 1 or less, or none, is the default |

## Features

- Zoom steps of 1.5×, 2×, 2.5×, 3×, 4×, 5× and 6× from the bar's buttons or the
  keyboard
- Drag the bar or the viewport to move the lens; drag the corner grip to resize it
  around its centre
- Full keyboard support:
  - On the lens: arrow keys to move, `+`/`-` to zoom, `Escape` to close
  - On the resize grip: arrow keys change the width and height
- Tap controls beside the focused lens move it and shrink or grow it without a drag
  (WCAG 2.5.7), and every control meets the 24×24 minimum target size (WCAG 2.5.8)
- Screen reader announcements for zoom, size and position changes
- Stays inside its containing block, and opens over the part of it on screen
- Connects to `AssessmentToolkitRuntimeContext` for ToolCoordinator integration

## Profile and policy

A personal needs profile grants the tool by listing `magnification` in `supports`.
The starting zoom is the `zoom` tool parameter, which the registration in
`@pie-players/pie-default-tool-loaders` reads through the toolbar and sets as the
`zoom` attribute. `createPersonalNeedsProfileFromAfa` maps an AfA record's
`magnification` `zoom-amount` to it, taking the `text` amount when the record sets
text and non-text apart:

```ts
createPersonalNeedsProfileFromAfa({ magnification: { "all-content": { "zoom-amount": 2.5 } } });
// { supports: ["magnification"], toolParameters: { magnification: { zoom: 2.5 } } }
```

The learner changes the zoom from there; a new host value replaces theirs.

The packaged registration places the tool at section level by default and supports
section, passage, rubric and item placement. Placement puts it on a toolbar; a
profile's `prohibitedSupports`, a district block or a test-administration override
withdraws it. It is not universal: magnification is a granted accommodation, so
`createUniversalPersonalNeedsProfile()` leaves it out.

## How the lens draws

CSS cannot paint one part of a document inside another, so the lens shows a copy.
The live document is serialized without scripts or event-handler attributes into a
sandboxed `srcdoc` iframe: open shadow roots become declarative shadow roots, every
style sheet is written out from its CSSOM, and form state, scroll offsets, canvas
pixels and video frames are copied across after the copy loads. The lens scales and
offsets the iframe with a transform, which follows its position, size, the zoom and
page scrolling every frame.

A mutation observer marks the copy stale, and it is re-rendered at most every
200 ms, or every four times the main-thread time the last render took when that is
longer, so copying a large page keeps to about a quarter of the main thread. Two
iframes alternate, so the new copy paints in the hidden one and swaps in when it has
loaded. Every lens is left out of the copy.

Highlights painted through the CSS Custom Highlight API, text-to-speech word and
sentence highlighting and annotation-toolbar highlights among them, are mapped onto
the copy's nodes and registered in its frame under the same names, where the copy's
own `::highlight()` rules paint them. They follow the page every frame, without
waiting for a re-render.

The copy is inert: it takes no input and runs no script, so the lens is a viewing
aid and the learner answers on the page beneath it.

## Limitations

- Closed shadow roots, cross-origin iframes and WebGL canvases without a preserved
  drawing buffer appear empty.
- A highlight over markup the HTML parser restructures, such as a block element a
  script placed inside a `<p>`, does not show.
- Top-layer content is not carried: a modal dialog shows as a non-modal one in
  place, and an open popover does not show.
- A custom element that renders its content only from script, with no open shadow
  root or light-DOM children, appears as it does before it upgrades.
- Changes to the page reach the lens a render or two late: well under a second on a
  typical section, and up to about five seconds on a page of 40,000 elements, whose
  copy takes over a second to render.

## Theming

The lens reads canonical theme tokens and defines none of its own: `--pie-primary`
for the border, `--pie-background` and `--pie-text` for the lens, and
`--pie-secondary-background` and `--pie-border` for the bar.
