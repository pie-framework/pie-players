---
"@pie-players/pie-assessment-player": patch
---

`ASSESSMENT_PLAYER_PUBLIC_EVENTS` no longer lists `submitRequested`. The player
never dispatched `assessment-submit-requested`, so a listener on it never ran.
