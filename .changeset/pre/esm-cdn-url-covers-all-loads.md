---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

`loaderOptions.esmCdnUrl` now covers every CDN load the players make. `<pie-print>` takes a `loaderOptions` property for its print modules; the item toolbar and the inline TTS tool load Font Awesome Free from the item player's ESM CDN; the IIFE math renderer loads its speech rules from it; and an import-map scope sends the root-path imports (`/npm/…`) inside jsDelivr-built `+esm` modules to the configured base, so a mirror serves one copy of each dependency. Adds `resolveEsmPackageFileUrl` and the `assetRoot` option of `initializeMathRendering` and `ensureItemPlayerMathRenderingReady`.
