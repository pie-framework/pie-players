---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-i18n-generated": patch
---

Formative delivery is renamed for its mechanism. The authored policy is `itemSessionControl` on sections and item refs, the module is `@pie-players/pie-players-shared/item-session-control`, the controller methods, events, types and persisted slice use the Try vocabulary (`recordTry`, `retryItem`, `revealItemFeedback`, `hideItemFeedback`, `getTryProjection`, `try-recorded`, `feedback-reveal-changed`, `tries`), and the interface messages move from `player.formative.*` to `player.check.*`. Every former `formative` name is gone: content authored with `formative` and sessions saved with a `formative` slice need the new keys.
