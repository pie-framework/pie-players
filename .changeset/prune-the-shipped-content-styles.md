---
"@pie-players/pie-theme": patch
---

Prune the shipped content stylesheet: remove what could not be made accessible,
tweak what could.

Removed. A `#stimulus` / `#item` pair of 50%-wide left floats hard-coded a
two-column layout keyed to two global ids: it cannot reflow at a
320px-equivalent width (SC 1.4.10), and being id-based it applied to any element
in the host document carrying either id. A `.lrn_feature h3` margin override and
`.lrn_width_auto.table` styled a third-party product's markup that PIE does not
render. None of the three had a correct form here.

Tweaked. The heading reset dropped `font-weight: 500`, which flattened every
authored heading to lighter-than-bold and weakened the visual hierarchy that
mirrors the heading level. The answer-eliminator toggle moves from a fixed 28px
box with an 18px glyph to `1.75em` / `1.125em`: PNP font scaling raises the
surrounding text without touching px boxes, so the control used to stay put while
its context grew — the em values are the same size at the default 16px base and
stay past SC 2.5.8's 24px minimum for any base at or above 14px. The centred
`.block-quote`, `.text-block` and `.equation-block` keep their 20% gutters on a
wide viewport but drop them below 30rem, where they otherwise left a ~190px
column.

Kept deliberately: the MathJax `font-family` overrides, `.text-center`'s
`!important`, and the bare `table` / `th` normalisation that authored tables
depend on.
