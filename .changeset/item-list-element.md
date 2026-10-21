---
"@pie-players/pie-item-list": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-i18n-generated": patch
"@pie-players/pie-theme": patch
---

Adds `<pie-item-list>`: `<pie-item-summary>` rows with a details column, host actions, the item's summary clipped below the first line of each of its `passages`, the entry's search `highlights` below it and a sticky expand button that mounts the item's players. An entry may leave `config` out and carry a `summary`, for a host that fetches the item on `expanded-changed`. A match snippet renders only its text and `<mark>` elements. `details`, `actions` and `highlights` take a custom element tag name, which receives the entry as `entry`, or a render function that may return an `{ update, destroy }` handle or a promise of one; a failing extension fires `extension-error`. `expandedIds` expands rows by id over `expanded`, and the list re-dispatches its rows' `load-complete` and `player-error` with the entry `id` and `part`. One i18n provider serves the list, its rows and their players. `<pie-item-summary>` and the list gain `loaderConfig`, passed to the player. The interface catalogs gain `player.list.expandA11y`, `player.list.collapse`, `player.list.playerError` and `player.list.highlights`, and the theme registers `--pie-item-list-clip-height` and `--pie-item-list-sticky-top`.
