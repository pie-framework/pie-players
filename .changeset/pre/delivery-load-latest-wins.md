---
"@pie-players/pie-item-player": patch
---

Overlapping `loadFromBackend("delivery")` calls now apply only the latest, as authoring loads already did. An older response that landed last used to replace the newer session.
