---
"@pie-players/tts-server-core": patch
"@pie-players/tts-server-google": patch
"@pie-players/tts-server-polly": patch
"@pie-players/tts-server-sc": patch
---

`SynthesizeResponse.audio` is typed `Uint8Array | string`, so the TTS
declarations typecheck without Node's types. The providers still return a
`Buffer`; code that calls `Buffer` methods on `audio` narrows it with
`audio instanceof Buffer` first.
