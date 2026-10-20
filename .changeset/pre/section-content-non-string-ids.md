---
"@pie-players/pie-section-player": patch
---

The section player refuses an item or passage id that is neither a string nor a number with a `TypeError` naming its path in the section. Such an id used to crash with an opaque `trim` error, or stringify to `[object Object]` for an item. A numeric passage id now reads as its decimal string, as item ids already did.
