---
"@pie-players/tts-server-core": patch
"@pie-players/tts-server-google": patch
"@pie-players/tts-server-polly": patch
"@pie-players/tts-server-sc": patch
---

`SynthesizeResponse.audio` is typed `SynthesizedAudioBytes | string`, a
structural description of the `Buffer` the providers return, so the TTS
declarations typecheck without Node's types and `audio.toString("base64")`
still compiles.
