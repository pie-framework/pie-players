---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-players-shared": patch
---

tts-inline follows the TTS service's run owner instead of a window-global slot: `speak` takes an `ownerId` and the rate the read starts at, and `getRunOwner()` names the run's owner, so a read another tool starts closes the inline panel. Content holding only a `data-catalog-idref` card is read, and the tool shows for it (`hasSpokenContent`). A read with nothing to speak says so, and a readiness failure reports `tools.textToSpeech.initFailed`, which replaces `tools.textToSpeech.inline.initFailed`. `setHighlightTargetResolverProvider` is required on `TtsServiceApi`.
