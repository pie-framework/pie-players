---
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-protractor": patch
---

The ruler and protractor no longer blank an announcement that follows another within a second: each keeps one timer for its live region. Closing either tool cancels its pending reveal, auto-focus and announcement timers.
