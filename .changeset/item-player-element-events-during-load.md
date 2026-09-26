---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

`<pie-item-player>` forwards the `session-changed` an element dispatches from its
`session` setter during load as its own canonical event; the element's raw event
used to reach the host. A second element's `session-changed`, or a second
`model.updated`, in the same task is no longer dropped.
