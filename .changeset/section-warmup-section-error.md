---
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
---

A rejected element warmup, which leaves a section's items unmounted, is now also
reported once as the section controller's `section-error`, with source
`section-runtime`, next to the `element-preload` framework error.
