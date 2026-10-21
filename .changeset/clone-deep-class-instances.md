---
"@pie-players/pie-players-shared": patch
---

`cloneDeep` copies only arrays and plain objects and carries any other object over by reference, so a `Date` or a bson `ObjectId` in an item config survives `addRubricIfNeeded` and the element-version overrides intact instead of flattening to its own keys.
