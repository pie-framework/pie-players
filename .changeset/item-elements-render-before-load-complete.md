---
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-shared": patch
---

`load-complete` waits for the item's elements to render, within the same
two-second bound as the markup's math. It went out after the models were
assigned and 60–110ms before the elements drew, so a host that reveals the item
on it showed a half-drawn item and read its render time low. An element still
empty once the player's DOM has been quiet for 200ms, such as a rubric shown to
a student, counts as rendering nothing.

Hosts P and M gate on `load-complete`, and the section player's `content-loaded`
and `pie-loading-complete`, which Host A counts, follow it: they now arrive once
the elements have rendered, and up to 200ms later for an item holding an
element that renders nothing.
