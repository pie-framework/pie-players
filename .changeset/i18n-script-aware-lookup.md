---
"@pie-players/pie-players-shared": patch
---

Locale resolution stays within the requested script. `zh-TW` and `zh-HK` reach a
`zh-Hant` catalog, and render English when only the Simplified `zh` ships;
`sr-ME` reaches `sr-Latn` and skips the Cyrillic `sr`. A request whose script
matches resolves as before. `./i18n/language-tags` adds `languageTagScript` and
`languageTagScriptsMatch`.
