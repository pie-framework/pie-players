---
"@pie-players/pie-item-list": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-i18n-generated": patch
---

Add `@pie-players/pie-item-list`: `summarizeItem` (from `./summarize`, Node-safe) reduces a PIE item to a readable summary, and `<pie-item-summary>` renders it as one sanitized list row with math as MathML and answers for instructors only, loading no element code. No summarizer resolver ships yet, so elements summarize from their prompt or label. The row's labels add `player.summary.*` keys to the bundled and generated catalogs.
