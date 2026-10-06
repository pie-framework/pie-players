---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
---

An item in a section is complete when every element of it that has reported its
completion is complete; the element that reported last used to decide.
`<pie-item-player>`'s `session-changed` carries the announcing element's model
id as `elementId`, and the section controller's `item-session-data-changed` and
`item-session-meta-changed` carry it too.
