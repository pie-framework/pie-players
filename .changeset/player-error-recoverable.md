---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

`player-error` carries `recoverable`, `true` when the item stays usable after a
failed update or controller, and its detail is exported as
`PieItemPlayerErrorDetail`.
