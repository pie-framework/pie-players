---
"@pie-players/pie-section-player": patch
---

Source the pane scrollbar thumb from `--pie-border-gray`, so a host that clears the generic boundary token keeps a visible scrollbar.

The three scrolling panes — split-pane passages and items, tabbed content, vertical content — defaulted `--pie-scrollbar-thumb` through `--pie-border`. A host that wants borderless tool chrome on its player subtree sets `--pie-border: transparent` alongside `--pie-button-border: transparent`, which is a supported thing to do with a canonical token, and got a transparent thumb on every pane: scrollbars present, invisible, in both regions. Before the thumb defaulted through a canonical token it fell back to a literal `#6b7280`, so the host's override was inert and the breakage arrived with the theme-tracking change.

`--pie-border-gray` is in the same boundary family, carries the same DaisyUI 3:1-against-surface correction, and is not one of the chrome knobs a host repoints to restyle buttons. Track and hover keep `--pie-background-dark` and `--pie-border-dark`. A host that wants different scrollbar chrome still sets `--pie-scrollbar-thumb` / `-track` / `-thumb-hover` directly. Those three stay package-private and unregistered, so the fallback chain is the contract rather than the token names.

The durable shape is `pie-theme` owning `--pie-scrollbar-*` as registered tokens rather than every pane defaulting through a boundary token; the three hooks are unregistered today, so any canonical token behind them stays reachable by a host override.
