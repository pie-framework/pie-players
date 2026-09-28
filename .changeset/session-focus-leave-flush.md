---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

Deliver a pending `session-changed` when focus leaves `pie-item-player`, so a host acting on the click or key that moved focus already has the response and the section-switch commit finds nothing left for that item. Every item-player `session-changed` now carries `component` and `complete`; a passage shell keeps its raw `session-changed` inside, like the item shell; and a session restored without `complete` is complete when it holds a response.
