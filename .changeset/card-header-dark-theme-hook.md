---
"@pie-players/pie-section-player": patch
"@pie-players/pie-theme": patch
---

Add `--pie-section-player-card-header-background-dark`, a card header fill applied under dark themes. A host whose brand tint is legible on a light card gets a near-white title on that same tint once a dark theme is active; this is the hook for giving the dark theme its own fill. It falls back to `--pie-section-player-card-header-background` when unset, so a host that sets only the light hook is unaffected. The passage card bridges the dark value to `--pie-passage-header-background` as well, so a hosted passage-player follows. Dark is detected with the same selectors the theme package writes its dark tokens under: `[data-theme="dark"]` on an ancestor, or `pie-theme[theme="dark"]`.
