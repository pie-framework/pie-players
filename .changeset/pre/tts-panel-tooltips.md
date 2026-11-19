---
"@pie-players/pie-tool-tts-inline": patch
---

The inline TTS trigger, speed, rewind, fast-forward and stop buttons show their accessible name as a hover tooltip (PIE-1546). The NDS trigger gets it on its inner button, which `<pie-nds-icon-button>` does not forward `title` to.
