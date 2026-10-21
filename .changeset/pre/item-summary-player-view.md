---
"@pie-players/pie-item-list": patch
"@pie-players/pie-item-player": patch
---

`<pie-item-summary>` gains `expanded`, `strategy` and `loaderOptions`: an expanded row mounts `<pie-item-player>` near the viewport and swaps it in once loaded, with element loads aggregated and capped page-wide. `@pie-players/pie-item-player` exports `preloadItemElements`, and `@pie-players/pie-item-list/browser` is a self-contained build for CDN use.
