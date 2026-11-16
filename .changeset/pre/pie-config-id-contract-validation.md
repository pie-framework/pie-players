---
"@pie-players/pie-players-shared": patch
---

`validatePieConfigContract` reports a model with no `id`, two models sharing one and two markup elements sharing one in a new `bindingWarnings` list; they do not invalidate the config, since content carrying them has always rendered. `updatePieElement` now updates every matching element even when some fail and rejects once, after all elements settle, with one error naming each failed element; the `model not found` message carries the element's `id`.
