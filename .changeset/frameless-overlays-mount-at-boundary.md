---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-line-reader": patch
---

Position frameless tool overlays against the content they are placed on.

A frameless overlay was appended next to the toolbar buttons, so whichever
element happened to be positioned became its containing block. At `passage` and
`item` placement that is `pie-item-toolbar`, a header-sized box, and the line
reader's opening position — derived from the viewport — put the panel outside
the card. Auto-focus then scrolled the pane across to reveal it, taking the
passage off screen. At `section` placement no positioned ancestor exists, so the
same coordinates resolved against the initial containing block and looked right.

`ToolRenderElement` gains `container`. A registration declaring
`container: 'content-boundary'` has its element appended to the nearest
`data-pie-tool-overlay-boundary` element — the box a host already marks as the
content a tool belongs to — and the section player's item and passage cards make
themselves the containing block for what lands there. The composition layer sets
it for frameless overlays, so the toolbar honours a declaration rather than
inferring intent from a tool's surface. A host declaring no boundary keeps the
previous in-toolbar mount, so section-level placement is unchanged.

The line reader derives its opening position from that containing block instead
of the viewport, centring on the part of it currently on screen — the midpoint
of a card several screens tall is not visible. Position and width are clamped to
the containing block on open, on drag, on keyboard movement, on resize and on
window resize, and it focuses with `preventScroll` so revealing it cannot scroll
an ancestor pane.

Ruler and protractor position by percentage, so they now self-centre in the card
they are placed on rather than in whatever box was positioned above it.
