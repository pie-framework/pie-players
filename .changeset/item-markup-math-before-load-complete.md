---
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-shared": patch
---

`load-complete` waits for the math in an item's and a passage's own markup to be
typeset, for at most two seconds. It went out before that typeset started, so a
host that reveals the item on it could show the markup's TeX raw for a moment,
then typeset at a different scale from the elements' math, shifting the layout.
A renderer that is torn down while it waits no longer emits `load-complete`.

Hosts P and M gate on `load-complete`, and the section player's `content-loaded`
and `pie-loading-complete`, which Host A counts, follow it: for an item whose
markup holds math they now arrive once that math is typeset.
