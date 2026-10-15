---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

Image and table scroll wrappers take the node's inline vertical margins, so a table with a negative top margin is no longer clipped, and the item player keeps a wrapper a focusable region only while it scrolls.
