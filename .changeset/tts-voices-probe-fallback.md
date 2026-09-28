---
"@pie-players/tts-client-server": patch
---

Endpoint validation for Polly and Google falls back to `${apiEndpoint}/voices`
when the provider-specific voices route returns 404, so a host that serves the
documented generic route keeps server TTS.
