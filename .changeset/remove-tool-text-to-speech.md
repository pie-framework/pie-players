---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
---

`@pie-players/pie-tool-text-to-speech` is no longer published; its last release stays on npm. Read-aloud is `pie-tool-tts-inline` in item and passage toolbars and the annotation toolbar's read-aloud for a selection. `TtsServiceApi.hasSpokenAlternate`, which only that panel called, is removed, and so are the panel's interface messages under `tools.textToSpeech` other than `name`, `description` and `inline`. Hosts A and R declare the package without importing it, so their ranges keep resolving to its last release.
