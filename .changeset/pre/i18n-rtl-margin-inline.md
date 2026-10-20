---
"@pie-players/pie-section-player": patch
---

The passage and item cards push end-of-row controls (the item toolbar, the
formative button) to the card header's trailing edge with
`margin-inline-start: auto` instead of `margin-left: auto`, so the control
follows the writing direction instead of sticking to the physical left. Under
`dir="rtl"` the toolbar previously sat against the card title at the start
side; it now sits at the inline end, mirroring the left-to-right layout. A new
`section-player-rtl-layout` spec holds the flip to geometry, which an
attribute assertion cannot see.
