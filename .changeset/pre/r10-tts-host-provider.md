---
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-assessment-toolkit": patch
---

A host can read aloud through its own `ITTSProvider`: `createTTSToolRegistration({ providers })` registers it under an id, and `tools.providers.textToSpeech.provider.id` selects it, with no `apiEndpoint` or server settings. `TTSToolProvider` takes the class as its `loadHostProvider` option. A config that names no registered host provider keeps its browser or server backend.
