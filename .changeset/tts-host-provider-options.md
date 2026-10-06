---
"@pie-players/pie-assessment-toolkit": patch
---

`buildRuntimeTTSConfig` passes the host's `providerOptions` through to the TTS
provider; the fields derived from the settings, such as `locale` and the Polly
engine, win over them. The host's object was dropped before.
