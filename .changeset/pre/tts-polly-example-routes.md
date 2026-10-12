---
"@pie-players/tts-server-core": patch
"@pie-players/tts-server-google": patch
"@pie-players/tts-server-polly": patch
---

The Polly SvelteKit example routes forward the full request the provider accepts
(`engine`, `format`, `sampleRate`, `speechMarkTypes` among it), answer with a
status chosen by `TTSErrorCode`, and pass credentials only when a key pair is
configured, leaving the AWS default credential chain to apply otherwise. Hosts
that copied the earlier routes can copy them again. Doc comments no longer quote
Polly prices or a Google voice count.
