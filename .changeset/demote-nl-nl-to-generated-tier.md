---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-i18n-generated": patch
---

`en-US` is the only catalog `players-shared` bundles. `BUNDLED_LOCALES` drops `nl-NL`, `BundledLocaleCode` narrows to `en-US`, and `loadBundledCatalog("nl-NL")` rejects — the provider treats that as the fallback chain, so a host whose loaders compose the generated tier resolves Dutch unchanged through the catch, while a host composing only `loadBundledCatalog` that requests `nl-NL` renders English where it rendered Dutch. The Dutch catalog itself — the framework's audit language, native-speaker-reviewed — moves verbatim into `@pie-players/pie-i18n-generated` as a `reviewed` catalog with its English snapshot, so a host that never installs the optional tier never fetches it. The provider unit tests exercise Dutch through a synthesized fixture now, and the item-list tests pin that a bare requested `locale` alone renders English while a composed host serves Dutch.
