---
"@pie-players/tts-server-google": patch
---

Studio voices take no `<prosody pitch>`, so a Studio request now applies `rate` and drops `pitch`, and `supportsPitch` is false when `voiceType` is `'studio'`.
