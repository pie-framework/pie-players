---
"@pie-players/pie-tool-periodic-table": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-item-player": patch
---

Fix the element-cell text in the periodic table, and the last two colours set
from JS.

The periodic table encodes element categories as fixed pastel fills, and the
symbol and name on them inherited `--pie-text` — near-white under every dark
theme, leaving the cell text at about 1.2:1 on a pastel. The fills are a data
encoding, so their ink is pinned to match: the tightest pairing it leaves is the
0.8-opacity atomic mass on the darkest fill, at 6.0:1. The selected-element panel
takes the theme surface rather than a category fill, so it keeps theme ink.

Under a colour scheme the fills collapse into the palette instead; see the
separate entry for `--pie-fixed-hue-collapse`.

The print player's "cannot load" frame drew bare `red` — 4:1 on white, and print
is the one surface where nobody sees the problem until it is on paper — and the
item player set a `#ddd` divider between stacked elements. Both now resolve
through the theme's families. `check:theme-tokens` gained a rule for this shape:
a paint set from an inline style string or a `.style.x =` assignment with a bare
literal now fails, which is how these two survived a stylesheet-only audit.
