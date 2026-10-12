---
"@pie-players/pie-section-player": patch
"@pie-players/pie-item-player": patch
---

The section controller runs `persist()` saves one at a time in call order, each with the session copied at the call, so a slow older save can no longer land after a newer one; a failed save rejects only its own caller. The item player resends a failed autosave once at the next flush (a `backend.delivery` repoint, the page going hidden, or teardown) when no later save for the same session replaced it.
