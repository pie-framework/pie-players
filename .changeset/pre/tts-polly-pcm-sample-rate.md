---
"@pie-players/tts-server-polly": patch
---

`PollyServerProvider` now defaults a `pcm` request without `sampleRate` to 16000 Hz. It sent 24000 Hz, which Polly rejects for pcm, so every such request failed with `INVALID_REQUEST`. mp3 and ogg keep the 24000 Hz default.
