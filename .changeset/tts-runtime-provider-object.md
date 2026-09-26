---
"@pie-players/pie-assessment-toolkit": patch
---

`resolveTTSRuntimeSettings` keeps `provider` only when it is a provider id. A
runtime provider object there, the form that carries `provider.runtime.authFetcher`,
reached `ServerTTSProvider` as its provider id, so a `backend: "server"` config
without `serverProvider` failed endpoint validation before sending a request and
fell back to browser TTS. `TTSToolConfig.authFetcher` is removed: nothing read it,
and credentials reach the provider through `provider.runtime.authFetcher`.
