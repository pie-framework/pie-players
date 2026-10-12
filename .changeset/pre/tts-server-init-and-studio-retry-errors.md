---
"@pie-players/tts-server-core": patch
"@pie-players/tts-server-google": patch
---

`BaseTTSProvider.ensureInitialized` throws a `TTSError` coded `INITIALIZATION_ERROR` where it threw a plain `Error`, and `GoogleCloudTTSProvider` maps a failed Studio audio-only retry through its gRPC code mapping where it rethrew the raw gRPC error.
