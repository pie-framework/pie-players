---
"@pie-players/tts-server-polly": patch
"@pie-players/tts-server-google": patch
---

The server providers' `getCapabilities()` drops the hard-coded voice and language counts from `extensions.providerSpecific`: `neuralVoicesCount`, `standardVoicesCount` and `languagesCount` on `PollyServerProvider`, `voicesCount` and `languagesCount` on `GoogleCloudTTSProvider`. `getVoices()` returns the actual roster. The Polly README's setup passes credentials only when both keys are set, leaving the AWS SDK default credential chain to resolve them otherwise.
