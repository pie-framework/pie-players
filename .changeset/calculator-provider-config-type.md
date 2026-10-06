---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
---

`tools.providers.calculator` is now typed as `CalculatorToolProviderConfig`, closed to the keys the calculator reads, so a misplaced key such as a top-level `authFetcher` fails to compile instead of being ignored. The key belongs at `provider.runtime.authFetcher`.
