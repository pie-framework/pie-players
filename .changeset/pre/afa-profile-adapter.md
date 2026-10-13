---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-tts": patch
"@pie-players/tts-client-server": patch
"@pie-players/pie-tool-tts-inline": patch
---

`createPersonalNeedsProfileFromAfa` builds a profile from an AfA PNP 3.0 record, and the PNP configuration guide gives each AfA feature's disposition. A profile's `activateAtInit` grants a tool and turns it on the first time a toolbar renders its button in a scope, under the new `pnp-activate-at-init` rule; `ToolPolicyEntry` carries the flag. A profile's `toolParameters` sit under the assessment's and item's, and the three layers now merge key by key where an item entry used to replace the assessment's whole. Read-aloud takes `rate`, `pitch` and `volume` from its `textToSpeech` parameters: `pie-tool-tts-inline` gains `base-rate`, `pitch` and `volume`, `TTSConfig` gains `volume`, and the server backend sends `pitch` on the `pie` transport.
