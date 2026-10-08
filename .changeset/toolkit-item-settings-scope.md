---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-print-player": patch
---

An item's policy settings now arrive through its `<pie-item-scope>` `settings` property, which the section player fills from each item ref, and govern only that item's own toolbar and content features; a section- or assessment-level toolbar reports a tool an item restricts or requires with `tool-policy.itemSettingNotApplied`. The toolkit's `currentItemRef` property and `ToolkitCoordinator.updateCurrentItemRef` are removed: set `settings` on the item's scope, or call `registerItemSettings`, instead.
