---
"@pie-players/pie-theme": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-section-player": patch
---

`components.css` styles authored content inside a `[data-pie-content]` element
only, which `pie-item-player` and `pie-print` set on the root they render into.
Its bare `h1`–`h6`, `table`, `th`, `.table` and `.center` rules no longer
restyle the host page. A host that renders authored markup outside a player
adds `data-pie-content` to that container to keep the styles there. A host
copy confined with `@scope (…)` keeps working when its scope root contains the
player.
