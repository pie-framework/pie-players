---
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
---

When the elements that did not register all failed to load, the item player
reports `player-error` at once instead of after the registration timeout. The
error's detail carries a `cause` that names each element and why it failed, such
as the module URL that did not load.
