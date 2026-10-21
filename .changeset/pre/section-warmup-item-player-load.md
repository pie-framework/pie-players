---
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

The section player's element pre-warm now loads through the item player's backend and tags, so in author mode or under a named ESM view it registers the editor and view tags its item players expect, and an author `env.mode` no longer switches it to the editor bundle while the players load delivery. `pie-item-player` exports `itemPlayerBackend` and `itemPlayerElementTags`, and `preloadItemElements` takes an `instrumentationProvider` and an `onBundleRetryStatus` option.
