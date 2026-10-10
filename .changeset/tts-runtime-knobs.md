---
"@pie-players/pie-tts": patch
"@pie-players/tts-client-server": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
---

`validateEndpoint` is gone from the TTS settings and the server provider's config: `endpointValidationMode` alone picks the probe `initialize()` runs, `none` when unset on the provider and `voices` on a toolkit `server` backend, as before. `resolveTTSRuntimeSettings` resolves `layoutMode`, an unknown value to `left-aligned`, so `resolveTTSLayoutMode` and `normalizeTTSLayoutMode` are removed and `TTSHostToolbarLayout` drops its constant `mount`. `speedRate` is typed by the new `SpeedRateBucket` from `@pie-players/pie-tts`, the custom transport's `providerOptions` keys (`speedRate`, `lang_id`, `cache`) are typed, and the server provider replaces a `speedRate` outside the three buckets with the one `rate` gives. `TOOL_ACTIVE_CHANGE_EVENT`, on `tools/registration`, names the event a tool element announces its open state with.
