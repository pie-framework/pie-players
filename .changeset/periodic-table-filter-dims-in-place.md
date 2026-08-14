---
"@pie-players/pie-tool-periodic-table": patch
---

Make the periodic table's category filter de-emphasise instead of empty the grid.

The cell markup has always carried a `--dim` class for elements outside the
active filter, but the each-block iterated an already-filtered list, so the class
could never apply: choosing a category removed every other element and left the
table as its own layout with holes in it. A periodic table read for one category
is still read against the whole table, so the filter now renders every element
and marks the ones outside it.

The dim treatment is not the `grayscale(80%)`/`opacity: 0.4` the dead rule
declared. Fading a cell far enough to read as dimmed composites its text towards
the page and takes it under 4.5:1 — 0.4 leaves it near 1.8:1 — and these cells
stay focusable and clickable, so SC 1.4.3 applies. A filtered-out cell drops its
category fill to the panel surface and takes theme ink instead, which measures
17.7:1 under the light Base Theme and 16.4:1 under yellow-on-blue, and it turns
its border dashed. The border *style* rather than its colour: under a colour
scheme every cell already shares one surface, so the fill can no longer carry the
state, and a stronger edge would read as emphasis when the matching cells' edge is
deliberately faint.

Dimming is visual, so a filtered-out cell also says so in its accessible name.
