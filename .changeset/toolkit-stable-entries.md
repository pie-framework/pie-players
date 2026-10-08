---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-tool-sign-language": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-tts-inline": patch
---

The toolkit's `./runtime/internal` and `./policy/internal` entries are removed, and `./tools/internal` is renamed `./tools/registration`, a stable entry for writing and rendering a `ToolRegistration`; `./runtime/engine` now carries the engine's input vocabulary, and the root carries the shell event bridge. The provider registry's `ToolProviderConfig` is renamed `ToolProviderRegistration`.
