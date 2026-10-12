---
"@pie-players/tts-server-core": patch
"@pie-players/tts-server-polly": patch
"@pie-players/tts-server-google": patch
"@pie-players/tts-client-server": patch
---

Server word highlights now land on the spoken word in text with accented or other non-ASCII characters. Speech-mark offsets index the request text in UTF-16 code units: Polly's byte offsets, its prosody envelope and a server's constant shift are resolved by anchoring each mark's word in the text (`anchorSpeechMarks`, also applied by `normalizeSpeechMarks` and the pie transport). Google keeps accented words whole and now marks authored SSML in place, so `<sub>`, `<break>`, `<say-as>` and entities reach the engine intact.
