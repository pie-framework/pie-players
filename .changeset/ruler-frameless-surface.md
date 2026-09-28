---
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-protractor": patch
---

A ruler on a frameless tool surface draws without Moveable's frame lines. The
frameless rules for the ruler and protractor matched nothing, because Moveable
renders its control box outside the tool's shadow root; the protractor already
hid the lines.
