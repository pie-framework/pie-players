---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-calculator-cortex": patch
---

Give every calculator the panel size its layout needs, and make the Cortex
calculator fit the panel it is given instead of clipping.

A graphing calculator has never opened at the size it declares. `ItemToolBar`
builds a tool shell from the first render and reads `initialWidth` once, but a
registration that sizes itself from render params sees none on that pass:
`getToolRenderParams` reads the resolved tool context, which arrives a render
later. So `calculatorType` was null, the calculator declared its untyped 380px
panel, and every graphing calculator — Desmos, GeoGebra and Cortex alike — opened
in a box a third of the width its two-column layout needs, with the plot column
clipped away. `applyShellStrings` already re-read the title on update, which is
why the header said "Graphing Calculator" over a panel sized for a basic one. The
shell now adopts a declared size that changed, and re-places itself because the
declared size is what `initialAlign` resolved against. A learner's own size wins:
once the panel has been dragged or resized it is theirs, and a re-render must not
snap it back.

Panel sizes are now per type, measured rather than assumed — 380x500 basic,
380x560 scientific, 720x660 graphing. Basic asked for 560 and needed 398px of
content, and the ~90px of blank above the entry line was that gap. The resize floor stays shared at
380x480: this registration serves Desmos, GeoGebra and Cortex alike, so a
graphing-only floor would move the limit under two vendors whose layouts were
never measured for it. Cortex below 42rem stacks the rail above the plot and needs
701px there, which no spacing tier closes — it scrolls its own content instead,
which is the contract every size below the opening one already relies on.

In the Cortex calculator itself, every fixed size is now a token, and the
calculator measures its own box and re-declares them in three tiers. Keys keep
the 44px of WCAG 2.5.5 at every size a panel opens at; below that they give up
height so the keypad keeps its rows, down to 28px, clear of 2.5.8's 24px floor at
Level AA. The tier is measured with a `ResizeObserver` rather than a
`container-type: size` query, which carries `contain: layout` and would make the
calculator the containing block for every fixed-position descendant, MathLive's
popovers among them. The `@media (max-height: 30rem)` rule this replaces asked the
viewport, so it never fired for a 406px panel in a 900px window — and the tool
wrapper's `height: 100% !important` had overridden its effect anyway.

Nothing is clipped now, at any size. Three separate causes: the calculator root
was pinned to the panel's height inside an `overflow: hidden` wrapper, so the
shell's own `overflow-y: auto` never saw anything to scroll; the keypad and the
graphing view's two panels were shrinkable flex items, and a flex item shrunk
below its content paints outside its box rather than clipping, which is how keypad
rows came to be drawn over the graph controls; and the plot carried a `width: 100%`
with a border at `content-box`, overflowing its column by exactly 2px. The root
now scrolls as the floor case, only the display yields among the rows, and the
graphing view places the pressure per layout: stacked, the panels hold their
content and the calculator takes one scroll; side by side they scroll in their own
columns, so the readout cannot push the plot off the panel. The readout is never
hidden or truncated either way — the board is `aria-hidden`, so that text is the
graph for assistive technology and for read-aloud.

`Clear history` rendered 96x20 and was the one control in the tool under 2.5.8's
24px; it now holds 28px. The keypad layer tabs wrap rather than running off a
320px panel.

The panel is now drawn as one instrument rather than as controls arranged on a
card, which is where the remaining space went. The visible `SCIENTIFIC CALCULATOR`
eyebrow is gone: the tool shell's header already carries that exact string, and a
second copy of it in a row of its own cost 46px of a 500px panel — a row neither
reference calculator spends. The heading stays in the tree as visually-hidden
text, so the region keeps its entry in the document outline. The angle mode moved
into the display, which has vertical slack a row of its own does not, pinned above
the tape's scroller so history passes behind it rather than pushing it away. The
display itself became a screen — a filled surface running to the panel's edges,
where before it was bare card around a lone bordered mathfield, which is what made
a 380x500 panel look like it had a hole above the entry line. Layer tabs,
backspace and clear moved onto the keypad's recessed plane as its head, so the
bottom of the panel is a single block; the tabs read as a tab strip rather than as
a row of pills. The keypad calculators drop the root's padding entirely, so screen
and keypad meet on one rule with no gutters, and the insets that remain are the
ones inside each surface — `--cortex-tape-inset` and the keypad's inline padding
are the same value, so the mathfield's text and the first key column share a left
edge. The mathfield's focus ring is inset now: at full screen width an offset ring
drew a box around the whole panel instead of around a control. Backspace and clear are glyph
faces with text accessible names and `title` on both: as two wide labelled buttons
they were the widest thing on the plane, and neither reference calculator spends a
bordered button on either.

In the graphing view the same treatment. The angle mode is declared by the view
that owns the setting and rendered in the expression rail, the layer tabs sit on
the keypad's plane, and the expression list became a pane that takes the column's
slack — sized to its rows it left ~140px of bare card between the keypad and the
bottom of a 720x660 panel.

The graphing board's `ResizeObserver` resized the board synchronously inside its
own callback, which raised an unhandled "ResizeObserver loop completed with
undelivered notifications" on every host page that opened a graphing calculator,
its `previousSize` guard notwithstanding. It is deferred a frame.

Section-demos gains a dedicated `calculator-desmos` demo, which the default
provider had never had — it appeared only incidentally in demos about other
things. It names `calculator-desmos` explicitly and shows the API key arriving
through `provider.runtime.authFetcher` at open time rather than in item content.
`SectionDemoRuntimePage` takes a `calculatorConfig` prop instead of keying
configuration off the provider name, because Desmos is what every other demo gets
by default and a lockdown keyed on `'desmos'` would have reconfigured the
calculator in a dozen demos that are about something else; the Cortex demo's
settings moved to its route with it. That demo deliberately does not set
`restrictedMode`: the Desmos adapter maps it to `expressions: false` for every
type, which on a graphing calculator removes the expression list and leaves graph
paper with no way to enter a function, so the demo locks down through Desmos' own
`restrictedFunctions` and chrome flags instead.

The panel-fit test compared the root's scroll height against its client height and
stopped there, which is why it passed while the shipped graphing panel cut off its
readout: the surplus never reached the root, because the flex items above painted
outside their boxes instead. It now walks every node, asserts that anything
overflowing can be scrolled to, that the calculator never scrolls sideways, and
that no target drops below 24px — at both the size each panel opens at and its
resize floor. The isolated demo's `shell` size was also one figure for all three
types and larger than any of them, so the size it measured was not a size that
ships; it is now per type, with a `Panel minimum` option beside it.
