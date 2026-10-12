---
"@pie-players/pie-item-player": patch
---

The item player's loading spinner stays inside the player. Its scrim had no
positioned ancestor, so while an item loaded, a cold bundle build's retry window
included, it covered the whole host page at z-index 9999 and blocked host
controls. The loading box now contains and isolates it, and reserves 120px of
height for the ring.
