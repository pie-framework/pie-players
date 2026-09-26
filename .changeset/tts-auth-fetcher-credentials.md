---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/tts-client-server": patch
---

What a TTS `provider.runtime.authFetcher` returns reaches `ServerTTSProvider`:
its `authToken` or `headers` go with every synthesis request, where before they
were dropped. Under `includeAuthOnAssetFetch` the audio fetch carries the
synthesis request's `Authorization` header, as the speech-mark fetch does; it
read only `authToken` before.
