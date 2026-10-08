---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tts": patch
"@pie-players/tts-client-server": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
---

A pause or stop issued while a read loads holds, media started during loading pauses the read, and a word spanning several text nodes highlights whole. `ITTSProviderImplementation.updateSettings` is required and `HighlightCoordinator.highlightTTSWord` takes the word's ranges; the TTS settings panel picks browser voices for the content language, `TTSToolProvider` reports its speech provider's features, a failed speech-rule-engine load is retried on the next read and warned about once, and read-aloud's debug lines log only under `PIE_TTS_DEBUG`.
