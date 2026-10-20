---
"@pie-players/pie-tool-magnifier": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
---

Add the magnifier (`magnification`, `<pie-tool-magnifier>`): a movable, resizable lens over a live copy of the page. The packaged tool set registers it at section level, and `createPersonalNeedsProfileFromAfa` maps AfA `magnification`'s `zoom-amount` (`all-content`, else the `selectMagnification` `text` amount) to its starting `zoom` tool parameter.
