---
"@pie-players/pie-theme": patch
---

Under `prefers-reduced-motion: reduce`, `components.css` ends every transition and animation inside `[data-pie-content]`, pseudo-elements included, so item content honours the setting (PIE-1563). Hosts V and M, which ship their own copy of `components.css`, get the backstop when they refresh that copy.
