---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-tts": patch
"@pie-players/tts-client-server": patch
---

Make Browser API playback reliable by coalescing and serializing rate updates,
publishing playback state and sentence highlighting from the provider's real
start event, and rejecting native speech that ends or stalls before starting.
Keep Chrome's native default voice unassigned while assigning explicitly chosen
non-default voices. Browser voice identifiers accept an exact voice URI or
documented name, while newly applied selections persist the unique URI. Server
fallbacks now carry only portable rate, pitch, and highlighting settings into
the Browser provider instead of leaking a server-specific voice. Ignore CSS-wide
custom-element reset declarations when checking for a duplicate PIE content
stylesheet.
