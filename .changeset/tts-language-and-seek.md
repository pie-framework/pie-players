---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/tts-client-server": patch
"@pie-players/tts-server-core": patch
"@pie-players/tts-server-polly": patch
"@pie-players/tts-server-google": patch
---

`TTSService.speak` resolves a read's language once for every entry point, a pinned `lang_id` stands in as the content language where markup and the tool name none, and a read without a language restores the host's locales. The Polly and Google servers pick a voice for the request's `language` when none is named, and the toolkit no longer names a default voice for them. A seek while paused moves the cursor and stays paused. The TTS settings panel's applies replace the previous backend's fields, and its browser preview reads through a `TTSService` of its own. A browser fallback no longer destroys a registry-owned provider, server audio reports start on `playing`, and a superseded audio element's error is ignored.
