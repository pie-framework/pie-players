---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-tool-ruler": patch
---

The ruler drags and rotates with its own pointer handling in place of Moveable,
through `createPointerRotateController`, `rotatedExtent` and
`clampOffsetOverlappingBlock`, now exported from
`@pie-players/pie-players-shared`. Its rotation handle has a 44px touch target.
Pointer and keyboard moves share one bound: the ruler may overhang the card it
opens on but keeps 100px inside it, where a drag could previously lose it
behind the card's edge and a keyboard move could not overhang at all. The
origin marker Moveable drew, which moved nothing, is gone.
