---
"@pie-players/pie-default-tool-loaders": patch
---

`PACKAGED_TOOL_TAG_MAP.textToSpeech` is `pie-tool-tts-inline`, the element the
packaged `textToSpeech` capability mounts. It named `pie-tool-text-to-speech`,
which the capability never loads.
