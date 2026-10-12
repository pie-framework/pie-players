---
"@pie-players/pie-tool-graph": patch
---

Enter or Space on the graph canvas no longer adds a point at `NaN` coordinates. Keyboard activation applies the current tool at a keyboard cursor, a ring shown while the canvas has keyboard focus, which starts at the canvas centre and moves one minor grid cell per arrow key. Enter or Space on a focused point no longer also triggers the canvas.
