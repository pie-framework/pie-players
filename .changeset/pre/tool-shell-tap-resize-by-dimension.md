---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
---

A floating tool window's tap resize controls now change its width and height one at a time, as its corner grips can: narrower, wider, shorter and taller buttons replace the shrink and grow pair, and Shift+arrow keys on the window's header resize along the arrow's axis. Hosts that override the `toolkit.window.shrinkA11y` or `growA11y` messages move to `narrowerA11y`, `widerA11y`, `shorterA11y` and `tallerA11y`.
