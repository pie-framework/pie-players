---
"@pie-players/pie-assessment-toolkit": patch
---

A `server` backend with `serverProvider: "custom"` and no `transportMode` now speaks the custom transport, as `ServerTTSProvider` does on its own; it took the `pie` transport before.
