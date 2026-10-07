---
"@pie-players/pie-players-shared": patch
---

`sanitizeItemMarkup` marks the elements of item and passage markup that carry an
authored color, with the `data-pie-authored-ink`, `data-pie-authored-fill` and
`data-pie-authored-border` attributes PIE elements put on their model HTML, and
drops `!important` from the marked declarations. `components.css` overrides the
marked colors under a color scheme, so authored colors in item and passage
markup follow the scheme as they do in element model HTML. The marking comes
from `@pie-element/shared-utils`, now a dependency.
