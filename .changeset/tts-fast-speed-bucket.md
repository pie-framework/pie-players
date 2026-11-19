---
"@pie-players/pie-tts": patch
---

`resolveSpeedRateBucket` maps rates from 1.05 up to `fast`, mirroring the 0.95 slow edge, so the inline TTS tool's default Fast choice (1.25) asks the custom transport for `fast` instead of `medium` (PIE-1545). Hosts A and S read aloud through the custom transport with the default speed choices, so their Fast button now changes speed.
