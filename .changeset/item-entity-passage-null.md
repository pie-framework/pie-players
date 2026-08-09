---
"@pie-players/pie-players-shared": patch
---

`ItemEntity.passage` accepts `null`, which is what importers actually write.

JSON has no `undefined`, so an item transformed from another format carries an explicit `passage: null` for "no passage" — the Learnosity import in `pie-api-aws` emits exactly that. The type allowed only `string | PassageEntity | undefined`, so real importer output failed to type-check on any typed path, and a host had to cast the null away to use it.

The runtime was never the problem: `isPassageEntity` has always tested `passage !== null`, a check that was unreachable under the declared type and load-bearing in practice. Widening the field is what makes that check mean something, and it is additive — every value that type-checked before still does.

Found by committing verbatim transform output as a fixture rather than hand-writing the shape the importer was assumed to produce.
