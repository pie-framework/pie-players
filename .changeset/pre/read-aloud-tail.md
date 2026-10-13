---
"@pie-players/pie-tts": patch
"@pie-players/tts-client-server": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/tts-server-polly": patch
"@pie-players/tts-server-google": patch
---

A server read whose response carries no speech marks highlights each sentence as it plays: the provider's `onPlaybackStart` passes a `TTSPlaybackStart` saying whether the audio carries word boundaries, and the reader paints the part's sentences when it does not. `<pie-tool-tts-inline>` lost its `language` property and speaks the runtime context's content language, as the annotation toolbar's read-aloud does, and it reports a read with nothing to read only under `PIE_TTS_DEBUG`. Neither tool logs a start failure to the console any more; the toolkit reports it. Read-aloud word highlighting re-adapts its colours when a `<pie-theme>` mounts after the reader or changes its theme, and stops observing on dispose. `PollyServerProvider` and `GoogleCloudTTSProvider` create their SDK client through a protected `createClient`, which a subclass can override.
