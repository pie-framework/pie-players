---
"@pie-players/pie-players-shared": patch
---

Sanitizers strip `autoplay` from authored markup, so audio and video start only through the item's `autoplayAudioEnabled` setting, which the toolkit's autoplay hold can stop.
