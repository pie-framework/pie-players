---
"@pie-players/pie-tts": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/tts-client-server": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
---

`TTSService.stop()` now also closes an open `<pie-tool-tts-inline>` panel, and `requestControlHandoff` and its handoff event are removed; a read that ends on its own keeps the panel open. Providers drop `isPlaying`, `isPaused`, `providerName` and `version`, and `TTSProviderCapabilities` keeps `supportsWordBoundary`, `defaultHighlightMode`, `supportsSSML` and `maxTextLength`. `ToolProviderApi.getCapabilities` and `ToolProviderCapabilities` are removed. `StandardTTSConfig` and `TTSConfigExtensions` fold into `TTSConfig`, and `mathTokenHighlighting` moves to the toolkit's TTS config. `TtsServiceApi` loses `isPlaying`, `isPaused`, `getCurrentText`, `getCapabilities`, `initialize`, `setHighlightCoordinator` and `setCatalogResolver`, `TTSService` loses `getLastError`, and `HighlightCoordinatorApi` replaces `highlightRange`, `clearHighlights`, `isSupported` and `updateTTSHighlightStyle` with `clearTTSWord`. `ensureTTSReady()` takes no argument, and `TTSService.ts` no longer re-exports the `@pie-players/pie-tts` types.
