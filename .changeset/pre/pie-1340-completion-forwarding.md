---
"@pie-players/pie-item-player": patch
---

`session-changed` forwards a change of an element's `complete` around an unchanged session with the session and without `intent`, so a host that skips metadata-only changes still sees the element complete (PIE-1340).
