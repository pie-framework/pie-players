---
"@pie-players/pie-item-player": patch
---

Backend model refreshes and `score()` now queue behind in-flight saves, and every save carries the session as it stood at its call, so an older write can no longer land after a newer one. A failed model or score request's session is resent once at the next flush, as a failed autosave already was.
