---
'@pie-players/pie-players-shared': patch
'@pie-players/pie-item-player': patch
'@pie-players/pie-section-player': patch
---

Add `focusFirst()` to `pie-item-player` and nest it after section navigation focuses the current item card.

- Export `queryFirstFocusableDeep`, `focusFirstFocusableInElement`, `isProgrammaticFocusTarget`, and `FOCUSABLE_SELECTOR` from `@pie-players/pie-players-shared` (deep traversal into **open** shadow roots; same selector basis as the focus trap).
- `pie-item-player.focusFirst()` moves focus to the first visible interactive control inside the item.
- Section player scaffold calls `focusFirst()` after programmatic focus lands on an item card (`start-of-content` without passage, and `current-item`).
