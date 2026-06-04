---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

Fix PIE-631: EBSR (and any element with `lockChoiceOrder: false`) no longer triggers an infinite render loop. A controller's persisted derived state (e.g. shuffled choice order) now round-trips back into the authoritative item session via a new `ItemController.mergeElementSession` and an `onElementSessionUpdate` callback on `updatePieElements`, so the order is reused across renders instead of being regenerated non-deterministically each cycle.
