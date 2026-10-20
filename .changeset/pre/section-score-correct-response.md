---
"@pie-players/pie-section-player": patch
---

The section layouts and the kernel host gain `provideScore()`, which resolves each item's `<pie-item-player>` `provideScore()` result in section order as `SectionItemScore` (`{ canonicalItemId, outcomes }`). `runtime.player.addCorrectResponse` is typed and documented; it reaches every embedded item player.
