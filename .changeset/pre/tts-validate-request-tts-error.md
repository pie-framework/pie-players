---
"@pie-players/tts-server-core": patch
---

`BaseTTSProvider.validateRequest` rejects with a `TTSError` carrying the provider id: `TEXT_TOO_LONG` for text over the provider's `maxTextLength`, and `INVALID_REQUEST` for blank text, an unsupported format, or a rate, pitch or volume out of range. The messages are unchanged. These were plain `Error`s, so a host mapping `TTSError.code` to an HTTP status answered them with a 500. Host R's SchoolCity route now answers blank and over-length text with a 400.
