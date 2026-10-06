---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

New opt-in `sessionSnapshot` config on `pie-item-player` writes each committed session to device storage and offers it back through `session-snapshot-available` and `getPendingSessionSnapshot()`. A snapshot is never applied, since on a shared device a stored draft is indistinguishable from a previous student's. It requires a delivery `sessionId` or an explicit host-supplied `key`.
