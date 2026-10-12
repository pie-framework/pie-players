---
"@pie-players/tts-server-polly": patch
---

Polly's `<prosody rate>` runs 20–200%, so `PollyServerProvider` now caps a request `rate` above 2 at `rate="200%"`, where it sent up to `400%` before.
