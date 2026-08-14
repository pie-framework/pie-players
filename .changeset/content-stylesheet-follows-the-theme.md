---
"@pie-players/pie-theme": patch
"@pie-players/pie-players-shared": patch
---

Paint the shared content stylesheet from the active theme instead of white-page
literals.

`components.css` is installed in the host document by every player, and its
authored-content classes carried the colours the content was written against: a
`lightgray` fill under `kds-*` table headers, `border: 1px solid black` grids and
fill-in boxes, a white `.pie-loading` scrim, `#dee2e6` rules on the
bootstrap-style `.table` family, and `color: red` emphasis. None of it could be
reached by swapping the theme, so a dark theme or colour scheme rendered
near-white header text on light grey (~1.2:1) and invisible table grids.

Ink resolves through `--pie-text`, page-coloured fills — the scrim and the
deliberately edgeless `.kds-verdana2t` border — through `--pie-white`, table
header fills through `--pie-background-dark`, and the loading ring through
`--pie-primary` at the 90% share the Figma indigo already was. Each keeps its
original literal as the no-theme last resort.

The subtle grid rules take an inline `color-mix` of `--pie-text` at 15% rather
than `--pie-border-light`: the DaisyUI mapping fills that token from base-200, a
surface, so a border taken from it disappears into the page. The mix stays inline
instead of being hoisted into a shared custom property, because a custom property
substitutes `var(--pie-text)` where it is declared, and a
`<pie-theme scope="self">` below `:root` would not reach it.

`.content-emphasis` keeps the authored hue but mixes 65% red toward the theme's
ink, which measures 7.0:1 on the default light page and 4.8:1 under `dracula`.
The literal it replaces sits at 4:1 on white and fails SC 1.4.3 today. One gap
remains: under `valentine`, whose own `base-content` measures 4.9:1, the mix
lands at 3.8:1 — better than the 3.3:1 pure red gave, and short of 4.5:1. Closing
it means dropping the red the author chose.

`PieSpinner` duplicates the `.pie-loading` rules and follows the same change.
