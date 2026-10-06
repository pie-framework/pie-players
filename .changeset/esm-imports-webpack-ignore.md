---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-print-player": patch
---

`strategy="esm"` works in a webpack-built host. Webpack compiled the runtime
`import()` of each element, controller, runtime-support and print-element URL
into an empty module context, so every load failed with
`ITEM_PLAYER_LOAD_ERROR` and the build warned "Critical dependency: the request
of a dependency is an expression". Those imports now carry
`/* webpackIgnore: true */` beside `/* @vite-ignore */`.
