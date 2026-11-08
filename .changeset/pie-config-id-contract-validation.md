---
"@pie-players/pie-players-shared": patch
---

Fail fast on model ids, the config contract's binding key. `validatePieConfigContract` now rejects a config whose models have a missing or duplicate `id`: the player matches models to markup elements and session entries by id strictly, so a duplicate bound silently to the first match and a missing id surfaced only later as an opaque per-element update failure. `updatePieElement` now updates every matching element even when some fail and rejects once, after all elements settle, with one aggregated error naming each failed element (the `model not found` message carries the element's `id`); previously a `Promise.all` rejection surfaced the first failure and hid which elements updated and which did not.
