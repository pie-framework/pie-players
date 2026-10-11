---
"@pie-players/tts-server-core": patch
"@pie-players/tts-server-google": patch
---

`BaseTTSProvider` request validation throws a `TTSError` with the same messages, coded `TEXT_TOO_LONG` for text over `maxTextLength` and `INVALID_REQUEST` for the other checks, and `ensureInitialized` throws one coded `INITIALIZATION_ERROR`; both threw a plain `Error`, so every server provider's validation failures were uncoded. `GoogleCloudTTSProvider` also maps a failed Studio audio-only retry through its gRPC code mapping. Host R's SchoolCity route maps `TTSError` codes to statuses, so it now answers an invalid request with 400 where it answered 500.
