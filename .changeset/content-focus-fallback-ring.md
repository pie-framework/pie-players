---
"@pie-players/pie-theme": patch
---

`components.css` gives a control in `[data-pie-content]` that sets no focus style of its own a 2px keyboard focus ring from `--pie-focus-keyboard-outline`, falling back through the chain the elements read, in place of the browser's ring, which ignores the colour scheme (PIE-1564). Hosts V and M, which ship their own copy of `components.css`, get the ring when they refresh that copy.
