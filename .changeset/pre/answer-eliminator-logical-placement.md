---
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-i18n-generated": patch
---

The answer eliminator's `button-alignment` now takes `start`, `end` and `inline`, defaulting to `inline`. `start` and `end` resolve against the choice's direction, and `left` and `right` remain as their aliases. A standalone element that left the attribute unset moves from `right` to `inline`; set `button-alignment="end"` to keep the old placement. The toggle's accessible name and the "(eliminated)" announcement now come from the players' catalog in the interface locale, and carry its `lang` and `dir`.
