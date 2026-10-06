---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-item-player": patch
---

Removes public surface that no package or known host uses: from the
players-shared root, the player-initializer helpers (`initializePiePlayer`,
`fetchItemData` and the rest of that module, which also left `./pie`), the
debug-panel persistence helpers and `QuestionEntity`; from its `./types`, the
CMS-era types (`QuestionEntity`, sessions and scores, organizations and users,
sanctioned versions, standards and blueprints); from the assessment toolkit, `loadAssessmentSession`,
`saveAssessmentSession` and `getAssessmentSessionStorageKey`; and the unused
`item-name` attribute of `<pie-item-player-session-debugger>`. The section
instrumentation map drops `pie-section-session-changed` and
`pie-section-composition-changed`, which never fired. `PieController.model()`
now declares the `updateSession` argument the player passes, typed as
`PieUpdateSession`.
