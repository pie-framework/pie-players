---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-assessment-player": patch
---

One canonical section session snapshot

`SectionControllerSessionState` and the four assessment-session shapes now live in
`@pie-players/pie-players-shared/types`, beside `AssessmentSection` and the
delivery slices the snapshot carries. `pie-assessment-toolkit` and
`pie-assessment-player` re-export them, so every existing import specifier keeps
working.

This replaces five byte-identical copies of a three-field `SectionSessionSnapshot`
— one in `pie-assessment-player` and one in each of four demo apps — that declared
`currentItemIndex`, `visitedItemIdentifiers` and `itemSessions` and omitted the
`formative` and `timedMedia` slices. No data was lost at runtime: both
`upsertSectionSession` implementations pass the snapshot through by reference. The
cost was that the assessment layer could not read the slices it was already
persisting without a cast, so a cross-section mastery rollup had no typed state to
build on.
