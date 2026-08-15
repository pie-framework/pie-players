---
"@pie-players/pie-theme": patch
---

Correct the answer-eliminator toggle's size, which the move to `em` overshot.

The toggle is specified at 28px with an 18px glyph on a 16px base, and going to
`em` was meant to keep those numbers while letting PNP font scaling carry them.
It did not: `width: 1.75em` sits on the same rule as `font-size: 1.125em`, and
`em` in a length resolves against the element's own font-size rather than the
parent's, so the box measured 31.5px — 12.5% over spec, with the comment above it
asserting otherwise.

The box now divides by the glyph factor, `calc(1.75em / 1.125)`: 28px at a 16px
base, still past SC 2.5.8's 24px minimum at the smallest base PNP offers, and
still scaling linearly with the surrounding text. The test pins the resolved size
rather than the unit, since the unit was never the thing at risk.
