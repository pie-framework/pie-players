---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-sign-language": patch
---

Add `@pie-players/pie-players-shared/media`, a side-effect-free entry holding
the media validation helpers: `isSafeMediaSrc`, `normalizeMediaSources`,
`normalizeMediaFragment`, `isUnsupportedMediaAssetVersion`,
`SUPPORTED_MEDIA_ASSET_VERSION`, `applyMediaFragment`, `enforceMediaFragment`
and `trimmedOrUndefined`. A PIE element can now validate authored media URLs
without importing the assessment toolkit, whose root entry brings TTS and the
calculator with it. The toolkit root re-exports the same names from the new
entry.
