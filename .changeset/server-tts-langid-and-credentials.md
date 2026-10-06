---
"@pie-players/tts-client-server": patch
"@pie-players/pie-assessment-toolkit": patch
---

The custom TTS transport sends the language as `langId` beside `lang_id`, so
servers that bind camelCase JSON receive it. A new `credentials` setting on the
server TTS provider sets the fetch credentials mode, letting a cross-origin TTS
endpoint authenticate by cookie.
