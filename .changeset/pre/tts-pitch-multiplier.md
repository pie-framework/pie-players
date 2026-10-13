---
"@pie-players/tts-server-core": patch
"@pie-players/tts-server-polly": patch
---

`SynthesizeRequest.pitch` is the Web Speech API's 0–2 multiplier, default 1, which the SSML providers already sent as a relative `<prosody pitch>` percentage. Validation now rejects a pitch outside 0–2: a semitone value such as `-5` or `5`, which the old −20–20 range let through, became a `-600%` or `+400%` prosody pitch. Polly sends pitch only on the standard engine, since neural voices do not support it, and `supportsPitch` reports that per engine.
