---
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

The section controller scores the section in the browser with `score()`, which resolves `{ items }` with each item's `provideScore()` outcomes in section order, and `commitPendingSessions()` commits pending element responses before a host reads or submits the session. The layout elements no longer have `provideScore()`; hosts call `getSectionController()?.score()` instead. An item player's load, error, backend and snapshot events reach the host as `item-player-event`, carrying the item's identity. `runtime.player.resolveItemProps(context)` sets player properties per item, and `runtime.player` is typed with the item player properties it forwards. Correct responses that `addCorrectResponse` fills render in a section's item players without entering the section session; the item player marks every `session-changed` it sends while they fill its session with `sessionSource: "correct-response"`, and neither saves nor snapshots that session: autosaves are skipped, and `saveSession()` and `score()` reject.
