---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-assessment-player": patch
---

`resolveInstrumentationProvider()` from `@pie-players/pie-players-shared/pie`
declares the `InstrumentationProvider | undefined` it always returned, in place
of `unknown`, so a caller can use the result without a cast or a structural
`isInstrumentationProvider` check.
