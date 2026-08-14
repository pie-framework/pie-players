---
"@pie-players/pie-theme": patch
"@pie-players/pie-theme-daisyui": patch
---

Add `--pie-content-emphasis` and take `.content-emphasis` from it.

The previous fix mixed 65% red toward `--pie-text`, on the strength of two
measurements. Sweeping all 35 shipped themes showed that was not enough: the mix
falls under SC 1.4.3's 4.5:1 on seven of them, and lands at 2.91:1 on `aqua`.
Lowering the red share does clear every theme, but only at 25%, where the colour
is no longer recognisably the red the content author chose.

The token is mapped from the DaisyUI error slot through the same `legible`
correction `--pie-incorrect` uses, which is the one construction that clears
4.5:1 against the page on all 35 — measured, not assumed. Its base-theme values
are a red chosen for the same bar (7.4:1 on the light page, 7.3:1 on the dark
one), and each built-in colour scheme mirrors the red it already declares for
`--pie-incorrect`.

A canonical entry rather than a package-private hook: authored content is host
content, so which red emphasis takes is a host decision, and the value has to
participate in colour schemes.
