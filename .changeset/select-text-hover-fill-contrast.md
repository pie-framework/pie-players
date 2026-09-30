---
"@pie-players/pie-theme": patch
---

Separate the select-text hover fill (`--pie-blue-grey-300`) from the page. It
sat at 1.19:1 to 2.82:1 against `--pie-background` across the base themes and
built-in schemes, and at 1.03:1 (`night`) to 1.37:1 (`aqua`) under the DaisyUI
provider, so a hovered token was indistinguishable from its neighbours.

The fill keeps the page's own ink, so it has to clear 3:1 against the page and
leave 4.5:1 for the text on it, which together need 13.5:1 of text on the page.
Both base themes and Black on White, White on Black, Rose on Green, Yellow on
Blue and Black on Rose now clear 3:1. Light Gray on Dark Gray, Grey on Light
Grey, Purple on Light Green, Black on Violet and Yellow on Navy are under 13.5:1,
so their fill moves as far from the page as 4.5:1 text allows. The DaisyUI
provider corrects `base-200` the same way, measured per theme.

The contract adds a `selectable hover text` relationship (`--pie-text` on
`--pie-blue-grey-300`, 4.5:1). A registered palette that changes `--pie-text`
without also supplying `--pie-blue-grey-300` now gets a contrast warning for it,
because the base fill is chosen for the base ink.
