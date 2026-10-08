---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

`<pie-item-scope>`, from `@pie-players/pie-assessment-toolkit/components/item-scope-element`, holds a plain item player for the toolkit's tools: the toolbar inside it takes the item from it, read-aloud reads its content region, and the toolkit files the item's accessibility catalogs. It publishes through `createShellScope`, as `<pie-item-shell>` and `<pie-passage-shell>` now do, and registers once it finds its toolkit, so it may mount first. The shells now republish a changed scope to tools already subscribed, which kept the first value before.
