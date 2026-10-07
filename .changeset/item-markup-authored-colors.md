---
"@pie-players/pie-players-shared": patch
---

`sanitizeItemMarkup` marks the elements of item and passage markup that carry an
authored color with the `data-pie-authored-ink`, `data-pie-authored-fill` and
`data-pie-authored-border` attributes PIE elements put on their model HTML, and
drops `!important` from the marked declarations, so a color scheme treats
authored colors in item and passage markup as it treats them in element model
HTML. The marking comes from `@pie-element/shared-utils`, now a dependency.
