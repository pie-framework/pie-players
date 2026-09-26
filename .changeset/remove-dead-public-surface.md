---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-item-player": patch
---

Removes public surface that no package or known host uses: from players-shared,
the player-initializer helpers in `./pie` (`initializePiePlayer`,
`fetchItemData` and the rest of that module), the debug-panel persistence
helpers, `QuestionEntity`, and the CMS-era types in `./types` (sessions and
scores, organizations and users, sanctioned versions, standards and
blueprints); from the assessment toolkit, `loadAssessmentSession`,
`saveAssessmentSession` and `getAssessmentSessionStorageKey`; and the unused
`item-name` attribute of `<pie-item-player-session-debugger>`. The section
instrumentation map drops `pie-section-session-changed` and
`pie-section-composition-changed`, which never fired. `PieController.model()`
now declares the `updateSession` argument the player passes, typed as
`PieUpdateSession`.
