---
"@pie-players/pie-print-player": patch
"@pie-players/pie-i18n-generated": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
---

The published types of `@pie-players/pie-print-player`, `@pie-players/pie-i18n-generated` and `@pie-players/pie-section-player-tools-instrumentation-debugger` no longer name `lit`, `@pie-players/pie-assessment-toolkit` or `@pie-players/pie-players-shared`, so installing them no longer installs those packages. `PiePrint` is typed as the new framework-free `PiePrintElement`; the toolkit and players-shared shapes its API takes are stated structurally.
