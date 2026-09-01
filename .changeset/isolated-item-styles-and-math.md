---
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
---

Keep item-player styles and custom math renderers authoritative.

Same-origin external styles now receive a private scope per default player
instance. Concurrent requests for one stylesheet share only the in-flight
fetch; style nodes are materialized per scope and released with their player.
Explicit custom classes and opted-in cross-origin link loading keep their
existing behavior.

Default math initialization no longer overwrites a custom renderer installed
while its dynamic import is in flight.
