---
"@pie-players/pie-theme": patch
---

Make the font size presets scale the players that actually render items.

`font-sizes.css` shipped, was exported, and scaled nothing this repo renders. Its
rules targeted only `pie-player`, the externally loaded item wrapper some hosts
render items through — so the section player's own content hosts
(`pie-item-shell`, `pie-passage-shell`) and the standalone `pie-item-player` were
never matched. The miss was invisible from the outside: `--pie-font-scale`
resolved correctly at every preset, and no rule consumed it.

Selecting a preset was worse than not selecting one. The stylesheet forced
`font-size: inherit !important` onto `*`, which collapses every heading, `<small>`
and superscript in an item to body size — at 100% scale, before any accommodation
takes effect. That blanket rule is gone; text now inherits from the content host,
so elements keep their own relative sizing.

No consumer was hit by that. Every rule in the file is scoped under a
`data-font-size` attribute and no recorded host sets it, so all three take only its
`:root { --pie-font-scale: 1 }` default today — which is also why changing these
rules is safe while renaming the file would not be. The consumer pad now records
that asymmetry.

The rules are scoped under `[data-font-size]` so the declarations exist only once
a host opts in, and no rule uses `!important` — a host has to be able to win
through the normal cascade, which is why `pie-theme`'s base-theme adapter already
keeps its own specificity low.

The four presets are unchanged (1 / 1.25 / 1.5 / 1.75, Learnosity's steps), and
so is the `data-font-size` contract. A host driving `<pie-theme>` can set
`--pie-font-scale` through `variables` instead and needs nothing from the
stylesheet.

What scales is inherited text, because `font-size` inheritance crosses shadow
boundaries. What does not is text whose own rule names `rem` or `px`: `rem`
resolves against the document root, `px` against nothing, and no rule inside a
subtree can change what either means. A host that needs those to follow scales
the root font size itself. That is documented rather than worked around, and
browser zoom is unaffected either way, so WCAG 2.2 1.4.4 does not rest on this.

The scale is applied as `calc(1rem * var(--pie-font-scale))` rather than an `em`
factor because the content hosts nest — an `em` factor compounds, and a requested
1.25 renders as 1.56 wherever an item shell sits inside a themed region.

No student-facing control ships here. Per PIE-478's own discussion the picker is
host chrome; this package owns the token, the presets, and the rules that consume
them. Nothing claims the `fontEnlargement` or `resizeText` PNP support ids yet
either — a support id is claimed by a capability registration, and there is no
capability to hang it on until the ownership question that story raises is
settled.
