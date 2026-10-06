---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/tts-client-server": patch
---

What a TTS `provider.runtime.authFetcher` returns reaches `ServerTTSProvider`:
its `authToken` or `headers` go with every synthesis request, where before they
were dropped. Under `includeAuthOnAssetFetch` the audio fetch carries the
synthesis request's `Authorization` header, as the speech-mark fetch does; it
read only `authToken` before.

For a server backend, the tool's registered config and the authFetcher's result
now win over the config passed to `ensureTTSReady(config)`, and a `voice` or
`pitch` the registration leaves unset clears the argument's. A host that changes
TTS settings at runtime calls `updateToolConfig` before `ensureTTSReady`.
