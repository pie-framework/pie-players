---
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-calculator": patch
"@pie-players/pie-calculator-cortex": patch
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-calculator-geogebra": patch
"@pie-players/pie-context": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-i18n-generated": patch
"@pie-players/pie-item-list": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/pie-theme": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-tool-calculator-desmos": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-tool-dictionary": patch
"@pie-players/pie-tool-graph": patch
"@pie-players/pie-tool-line-reader": patch
"@pie-players/pie-tool-magnifier": patch
"@pie-players/pie-tool-periodic-table": patch
"@pie-players/pie-tool-picture-dictionary": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-sign-language": patch
"@pie-players/pie-tool-theme": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-tts": patch
"@pie-players/tts-client-server": patch
"@pie-players/tts-server-core": patch
"@pie-players/tts-server-google": patch
"@pie-players/tts-server-polly": patch
"@pie-players/tts-server-sc": patch
---

The `@pie-players/pie-players-shared` root now lists its exports by name. The object helpers, attribute coercion and content styles are exported only from their subpaths (`/object`, `/ui/attribute-coercion`, `/ui/content-styles`), and the root no longer carries internal UI helpers that no published package or host imports from it: `createPointerRotateController`, `normalizeDegrees`, the safe-storage helpers, `isTabbable`, `scopeSelector`, the overlay geometry functions and placement step constants, and the pointer and overlay helper types. The test-only `resetContentStylesWarningForTesting` is gone from every entry.

Every package exports `./package.json`, so a tool can read the installed version through the `exports` map.

Only the four CDN entry points keep `unpkg` and `jsdelivr`. The section player's and the item list's now name their `dist/browser/` build, which is the file a CDN page loads; every other package drops both fields.
