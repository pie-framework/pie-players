---
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
---

Fold two pinned accents into the palette when a colour scheme asks for one.

The section player's selected passage/questions pill was a fixed `#1D7375` that no
scheme could reach. Its own white-on-teal text is legible, but as the mark of which
tab is selected the fill owes 1.4.11's 3:1 against the track, and it measured
1.42:1 under Yellow on Navy, 2.26:1 under Light Gray on Dark Gray and 2.80:1 under
Black on Violet.

The inline calculator's open-state trigger was worse, because there the pinned
value was the ink: the fill already followed `--pie-primary` while the text stayed
`white`. On the schemes whose primary is a pale yellow that pairing is about 1:1 —
1.06:1 under Yellow on Blue, 1.07:1 under White on Black, 1.05:1 under Yellow on
Navy — so the glyph vanished on three of the palettes chosen for legibility.

Both now use the `--pie-fixed-hue-collapse` mechanism the periodic table
established: the pinned value is exact at 0%, which is every Base Theme, and at
100%, which is every scheme, the fill resolves to `--pie-primary` and the ink to
`--pie-background`. That pairing holds at 5.44:1 or better on every built-in
scheme, and because the track and the trigger's surroundings paint
`--pie-background`, the same ratio separates the fill from what it sits on. Mixing
rather than substituting keeps the ink clear of the light Base Theme's transparent
`--pie-background`, where a substitution would render it invisible.

Two consequences worth knowing. The calculator's deeper hover fill collapses to
`--pie-primary` rather than `--pie-primary-dark`, since that darker slot pairs
with the page colour at 3.56:1 under Light Gray on Dark Gray; under a scheme the
hover therefore matches the open state and the affordance rests on the border. And
the host override hooks still win in both components, unchanged.
