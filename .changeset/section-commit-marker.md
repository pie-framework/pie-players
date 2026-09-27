---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
---

A commit is now marked with `sessionCommitReason` on `item-session-changed`, on
the toolkit's `session-changed`, and on the section controller's
`item-session-data-changed` and `item-session-meta-changed`, and the
controller's two events carry `sectionId`. A commit at navigation reports the
item being left, so a host that sets its current item from these events should
leave that state alone on a commit and still persist its session.
