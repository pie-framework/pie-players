---
"@pie-players/pie-item-player": patch
"@pie-players/pie-theme": patch
---

`pie-item-player`, `pie-item-player-session-debugger` and `pie-theme` are in
`HTMLElementTagNameMap`, so `document.createElement` returns them typed.
