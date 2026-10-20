---
"@pie-players/pie-section-player": patch
---

The `iife-bundle-host` attribute takes effect: it sets `loaderOptions.bundleHost` for the pre-warm and the rendered item players when `runtime.player.loaderOptions.bundleHost` is unset, where the default bundle host used to win. Host R's playground passes it, so its IIFE previews now load bundles from the host it names.
