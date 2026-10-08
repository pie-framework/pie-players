---
"@pie-players/pie-assessment-toolkit": patch
---

Browser speech that stands in for a Polly, Google or custom backend no longer inherits that backend's voice, which made every speak fail; every fallback path carries the same portable settings. The browser provider voices an authored `<speak>` document as its spoken text instead of reading the tags aloud.
