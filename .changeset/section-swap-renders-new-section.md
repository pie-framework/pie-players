---
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
---

A section player given a new `section-id` and then a new `section` on the same
element now renders the new section. Under the bundled Svelte 5.57.0 the player
stopped updating after that sequence and kept showing the previous section's
items, while `pie-stage-change` reported the new section as composed. The
packages now bundle Svelte 5.57.1.
