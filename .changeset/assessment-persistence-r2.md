---
"@pie-players/pie-assessment-player": patch
---

The assessment controller runs saves one at a time in call order, so an older save can no longer overwrite a newer one. `submit()` now saves first and marks the assessment submitted only after that save succeeds; a failed save rejects `submit()` and leaves the assessment unsubmitted.
