---
"@pie-players/pie-item-player": patch
---

A controller's write-back of derived session state, such as a shuffled choice
order, no longer dispatches a `session-changed` of its own without `complete`,
`component` or `elementId`, so it no longer reaches a section as an
`item-session-data-changed` without `complete`. The player's `session`
container holds it at once, and the next `session-changed` carries it with the
announcing element's `complete`.
