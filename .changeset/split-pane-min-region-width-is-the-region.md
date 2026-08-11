---
"@pie-players/pie-section-player": patch
---

`splitPaneMinRegionWidth` now bounds the region, not the grid track it sits in.

Each pane spends `0.5rem` on each side as margin rather than padding, so the
gutter sits outside its scroll box. The bound was computed against the track, so
a host asking for 280px to keep a passage legible got a 280px track holding a
264px region, and the shortfall grows with the gutter. The gutter is now measured off the pane and added to the track
the percentage has to reach, so the region is the width that was asked for.

Hosts setting this get a slightly wider minimum than before, which is the width
they configured. A host that tuned the value against the old behaviour and wants
the previous geometry should reduce it by the pane gutter (16px by default).
