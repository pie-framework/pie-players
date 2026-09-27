---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

`<pie-item-player>` forwards an element's `session-changed` only when its
`complete` or its session changed since that element last announced. An element
that announces whenever it is handed its session no longer produces a second
event at load, and no longer re-announces its unchanged `complete` after another
element's response, which let a multi-element item's completion follow whichever
element announced last.
