---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-tts": patch
"@pie-players/tts-client-server": patch
---

Read-aloud has one entry: `ttsService.speak(target, options)` reads a DOM range or element, with spoken cards, math speech and `data-tts-suppress` applied the same way on every path. `speak(text)` and `speakRange` are removed; a caller passes the element or range it read. `TTSService.dispose()` is added, and the coordinator's dispose calls it.

A new speak stops a recorded clip still playing, a pause between two parts of a read holds the next part, and a superseded server read no longer logs an error. The server provider sends the language a read names, except that a host's `lang_id` wins on the custom transport, and text over a provider's `maxTextLength` is read in pieces. Two toolkits on one page share the page's highlights, and a theme change keeps the read-aloud colors adapted to the content.
