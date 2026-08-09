---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

Remove `SignLanguageExtractor`. A signed alternate is a catalog card, authored or imported, never lifted out of item markup at render time.

The extractor mirrored `SSMLExtractor` for signing: it found `[data-sign-language]` video regions in an item's markup, prompts and choice labels, turned each into a `sign-language` card, removed the video from the visible content and docked the card via `data-catalog-idref`. Section-player ran it on every item card mount.

Nothing produced that inline form. The Learnosity transform in `pie-api-aws` writes `accessibilityCatalogs` directly, and signing is new enough in PIE that no legacy content carries a video inline — the attribute's only producer was this repo's own demo. The symmetry with `SSMLExtractor` was the whole case for it, and it does not hold: inline `<speak>` is real authored content PIE does not control.

It also failed in the wrong direction. Extraction needed `DOMParser`, so under SSR it no-opped, and a parse error took the same path — in both cases the `<video>` stayed in the visible prompt and rendered to every learner, granted the accommodation or not. A card cannot leak that way, because it was never in the content. Its synthesized catalog ids were positional (`auto-sign-prompt-q1-0`), so inserting a signing region renumbered the reference docking another one.

Breaking for anyone importing `SignLanguageExtractor`, `SIGN_LANGUAGE_ATTRIBUTE` or `SignLanguageExtractionResult` from `@pie-players/pie-assessment-toolkit`, and for `prepareSignLanguageItem` from section-player's shared components: author the card on `accessibilityCatalogs` instead, at item or model level. Resolution, gating and rendering are unchanged — `collectSignLanguageCatalogRefs` reads the same three places catalogs hang off an entity as it always did. `SSMLExtractor` is untouched.
