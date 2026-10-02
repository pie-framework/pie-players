---
"@pie-players/pie-theme": patch
---

Every copy of `@pie-players/pie-theme` on a page shares one provider registry,
on `window.PIE_THEME_PROVIDERS`, so `<pie-theme>` sees providers registered
through a copy other than the one that defined it. Copies before this release
keep a registry of their own.
