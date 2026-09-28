---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-print-player": patch
---

The `esm` strategy loads in Firefox on pages where it rejects the player's
import map: after the page's first module load, or when the page already has
one. The player detects the rejected map and loads the elements through a
bundled es-module-shims in shim mode; browsers that apply the map load natively
as before. A page that runs its own es-module-shims must run it in shim mode.
