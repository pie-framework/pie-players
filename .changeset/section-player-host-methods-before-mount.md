---
"@pie-players/pie-section-player": patch
---

The layout elements' host methods are defined as soon as the element is created,
so a host can call them before it mounts: `waitForSectionController()` waits for
the controller, and the other methods return what they return while the player
loads.
