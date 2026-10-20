---
"@pie-players/pie-item-list": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-i18n-generated": patch
"@pie-players/pie-theme": patch
---

Adds `<pie-item-list>`: `<pie-item-summary>` rows with a details column, host actions, the item's summary clipped below its passage's first line, the entry's search `highlights` below it and a sticky expand button that mounts the item's players. A match snippet renders only its text and `<mark>` elements. `details`, `actions` and `highlights` take a custom element tag name or a render function that may return an `{ update, destroy }` handle. `expandedIds` expands rows by id, and one i18n provider serves the list, its rows and their players. The interface catalogs gain `player.list.expandA11y` and `player.list.highlights`, and the theme registers `--pie-item-list-clip-height` and `--pie-item-list-sticky-top`.
