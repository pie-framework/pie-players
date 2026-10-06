---
"@pie-players/pie-tool-text-to-speech": patch
"@pie-players/pie-assessment-toolkit": patch
---

`<pie-tool-text-to-speech>` speaks the selection. It reads through the
`ttsService` property as the host configured it, where it used to re-initialize
that service with the browser provider on mount and then fail on every Play.
Hosts pass an initialized service. The speed slider sets the service's playback
rate, the controls reset when speech ends or fails, and removing the element
removes its selection listener. `TtsServiceApi` declares the optional
`hasSpokenAlternate` the panel already calls.
