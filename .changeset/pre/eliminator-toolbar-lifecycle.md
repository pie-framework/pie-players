---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-default-tool-loaders": patch
---

The answer eliminator no longer comes back on when the learner returns to an item; it resets with the item's other tools. The item toolbar releases every coordinator entry of its item when the item changes, including one a tool element registered itself, so `getVisibleTools()` stops reporting entries for items the learner left. `<pie-tool-answer-eliminator>` no longer registers with the coordinator, follows a `strategy` change after mount, and drops its `toolId` and `scopeElement` properties: it reads its item root from the enclosing `<pie-item-scope>`.
