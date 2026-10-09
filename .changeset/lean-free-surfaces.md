---
"@pie-players/pie-section-player": patch
"@pie-players/pie-tts": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-assessment-toolkit": patch
---

Remove surfaces nothing reads. `ReadinessPolicyAdapter` is no longer exported from `@pie-players/pie-section-player`; a host that imported the type gets a compile error. `TTSConfigExtensions.organizationId` and `region` are gone from `@pie-players/pie-tts`; a config literal that sets them no longer type-checks. The TTS inline control no longer receives a `tool-id` attribute, which it never read. `@pie-players/pie-assessment-toolkit/tools/registration` exports `waitForBrowserVoices`, and the browser TTS provider now waits for the voice inventory once, during initialization, up to two seconds.
