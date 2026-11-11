---
"@pie-players/pie-item-player": patch
---

`<pie-item-player>` gets `focus(options?)`, which focuses the item's first input and resolves whether focus moved. It asks each element through its `focusFirstInput()` hook and otherwise focuses the element's first tabbable descendant. A call made while the item loads waits for `load-complete` and keeps focus the learner moved in the meantime. The player's `focus()` did nothing before, since the player has no tab stop of its own.
