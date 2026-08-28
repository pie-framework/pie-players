---
"@pie-players/pie-calculator-cortex": patch
---

Give the graphing calculator keyboard-operable pan, zoom and reset, and make
reset work at all.

JSXGraph moves its viewport only from pointer bindings — drag, wheel, pinch — so
a keyboard-only or switch-access learner could read the default window and
nothing outside it; the keyboard trace moves within the sampled window and
cannot leave it. Six controls now sit beside `Reset view`, each a real button
with a text accessible name.

`Reset view` itself never worked. It called `setBoundingBox`, which recomputes
the units and moves the origin but does not commit, and whose default third
argument resets the zoom factors — so the next board update recomputed the
previous window. Every viewport control now calls the board's own navigation
methods, which are what its (hidden) navigation bar calls.

The keyboard trace advances a fixed fraction of the series rather than one
sampled point. The sampler takes one point per pixel, up to 1,200, so traversing
the plot previously cost as many presses as it was wide.
