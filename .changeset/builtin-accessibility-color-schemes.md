---
"@pie-players/pie-theme": patch
---

Add four built-in accessibility color schemes: Grey on Light Grey, Purple on Light Green, Black on Violet, and Yellow on Navy.

Each scheme ships in both places a scheme has to exist to be usable:

- a `[data-color-scheme="<id>"]` block in `color-schemes.css`, setting the full
  token set (text, primary/secondary/tertiary, backgrounds, borders, focus, and
  correct/incorrect/missing states) so a host can activate it with the attribute
  alone.
- a `BUILTIN_PIE_COLOR_SCHEMES` entry in `color-schemes.ts`, carrying the
  variables a scheme applies programmatically plus the `preview` swatch trio
  (`bg`, `text`, `primary`) that scheme pickers render.

Purely additive: the six pre-existing schemes are untouched, and a host that
sets no `data-color-scheme` is unaffected.
