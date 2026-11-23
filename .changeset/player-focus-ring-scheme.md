---
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-assessment-toolkit": patch
---

The focus rings of the split dividers, the passage and media-gated item cards, the section tabs, the assessment Back and Next buttons and the floating tool window's header and buttons now take each color scheme's `--pie-button-focus-outline`, where most kept a fixed blue that fell below 3:1 against the page under three schemes each, yellow-on-navy at 1.5:1 (PIE-1561); under the default theme they turn from `#146eb3` or `#1d4ed8` to its `#3b82f6`. The tool window's buttons no longer draw a ring when clicked.
