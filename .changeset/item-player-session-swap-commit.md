---
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
---

A host that hands a mounted player a session with a different id, as a section card keyed by item id does when the next section shows the same item, no longer has the outgoing element's pending response written into the incoming session: the response is committed with the session it was given for first. An empty session with a new id now replaces the previous attempt's responses instead of being ignored, so a new attempt on the same item starts unanswered.
