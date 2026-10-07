---
"@pie-players/pie-players-shared": patch
---

`sanitizeItemMarkup` marks the elements of item and passage markup that carry an
authored color, with the `data-pie-authored-ink`, `data-pie-authored-fill` and
`data-pie-authored-border` attributes PIE elements put on their model HTML, and
drops `!important` from the marked declarations. They are what a color scheme
will override authored colors through; no stylesheet targets them yet. The
marking comes from `@pie-element/shared-utils`, now a dependency.
