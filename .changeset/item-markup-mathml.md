---
"@pie-players/pie-players-shared": patch
---

`sanitizeItemMarkup` keeps MathML that authored item and passage markup uses and
DOMPurify drops: elementary math (`mstack`, `mlongdiv` and their groups, rows,
lines and carries, with their attributes), `mspace`'s `linebreak`, `semantics`,
`annotation`, `none` and prefixed MathML such as `<mml:math>`.
Stacked arithmetic and long division rendered as a row of digits, a TeX
annotation showed as text and prefixed MathML as its bare text.
