---
"@pie-players/pie-theme": patch
"@pie-players/pie-tool-periodic-table": patch
---

Collapse fixed component hues into the palette under a colour scheme.

A component sometimes paints a hue the palette does not own: the periodic
table's element cells encode category as a fixed pastel. Pinning their ink made
them legible under a dark theme, but a colour scheme is a two-colour promise,
and a pastel field ignores it — a learner on yellow-on-blue got a pastel grid.

`--pie-fixed-hue-collapse` is the share by which such a hue folds into the
palette. A component mixes its own value towards `--pie-background-dark` and
`--pie-text` by this share, so `0%` renders the authored hue exactly and `100%`
removes it. Base Themes set `0%`; every built-in colour scheme sets `100%`, and
a registered custom scheme collapses without declaring anything, because it is a
palette a host chose for a learner. A scheme that wants a hue encoding kept sets
`0%` itself.

Both ends of the mix are exact, so a Base Theme renders the periodic table byte
for byte as before. Under a scheme its cells take the scheme's recessed surface
and ink — measured across all ten built-ins, 5.44:1 at worst and 19.26:1 at best
— and the cell edge takes `--pie-border`, which the palette corrects to 3:1,
because collapsed fills sit on the panel at about 1.1:1 and can no longer
separate themselves. Category then lives where it does not depend on hue: the
badge row filters by it, the selected-element panel names it, and each cell's
accessible name carries it.

Sweeping those ten also cost the cell's secondary text its opacity. Fading the
atomic number, name and mass spent contrast the palette cannot always afford: at
0.8 the atomic mass measured 4.12:1 under grey-on-light-grey and 4.00:1 under
purple-on-light-green, whose ink and recessed surface hold only 6.46:1 and 5.44:1
before anything is faded. Size and weight carry the hierarchy instead, which also
lifts the worst pairing under a Base Theme from 6.01:1 to 8.99:1.

`--pie-text` against `--pie-background-dark` is now a certified contrast
relationship, since that pair is where a collapsed hue lands. Every built-in
palette already clears it; a custom scheme that does not now warns.
