---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-tool-protractor": patch
---

The protractor drags and rotates with its own pointer handling in place of
Moveable, turning about its vertex through a 44px rotation handle. Pointer and
keyboard moves share the ruler's bound: it may overhang the card it opens on
but keeps 100px inside it. `createPointerGesture`, which both tools now use to
claim a press and end the gesture on `pointercancel`, and
`rotationCentreShift` are exported from `@pie-players/pie-players-shared`.
With neither tool using it, `moveable` is no longer bundled and the unreleased
`@pie-players/pie-players-shared/moveable` entry is gone.
