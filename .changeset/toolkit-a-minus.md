---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-tts": patch
---

`ToolProviderApi` takes no config type parameter: it is `ToolProviderApi<TInstance>`, and an implementation narrows its config in its own method signatures. `pie-loading-complete` no longer carries `loadedCount`, which always equalled `itemCount`. The browser TTS provider reports `supportsWordBoundary: true`, since it forwards the boundaries its voice sends, and keeps sentence highlighting as its default through the new `TTSProviderCapabilities.defaultHighlightMode`.
