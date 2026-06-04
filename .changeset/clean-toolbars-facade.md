---
"@pie-players/pie-section-player": patch
---

Remove the separate `@pie-players/pie-toolbars` facade package. Section player now imports toolbar custom-element registration entrypoints directly from `@pie-players/pie-assessment-toolkit/components/item-toolbar-element` and `@pie-players/pie-assessment-toolkit/components/section-toolbar-element`.
