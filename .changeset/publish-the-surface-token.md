---
"@pie-players/pie-theme": patch
---

Publish `--pie-surface` as a canonical, required Scheme Participant.

The raised-surface colour that `@pie-lib/drag`'s answer pools read through
`color.surface()` was never declared by this package, so every consumer fell
through to the hardcoded `#E0E1E6` in `pie-lib` — a light grey that stayed light
grey on the dark, high-contrast, and coloured schemes. It now resolves from the
theme, giving answer pools and inline TTS panels a surface that follows the
active palette.

Declared in the light and dark Base Themes and all ten built-in schemes, mapped
from a blend of DaisyUI `base-300` and `base-100`, and recorded in `token-registry.json` as
`canonical-semantic` / `surface`. A host that was already setting
`--pie-surface` keeps its override; a host that was not now inherits a
scheme-correct value where it previously got `pie-lib`'s constant.

The initial dropdown tints failed text contrast in Purple on Light Green
(4.13:1) and DaisyUI Valentine (4.17:1), and weakened the light base's focus ring
to 2.82:1. Reuse existing accessible tints for those surfaces and also correct
DaisyUI focus rings against the raised panel; Cupcake measured 2.93:1 there.
Built-in contrast diagnostics and the real TTS browser test now cover these
relationships. Custom-scheme examples carry the raised surface and its control
colours where an overlay changes the page's polarity.

Consumer impact: the recorded Host V and Host A token overrides remain valid;
neither recorded set includes `--pie-surface`, so their fallback surfaces change
on upgrade. Host R's stylesheet/managed-theme integration receives the new
registry entry and scheme values. Explicit managed `variables` overrides and
stylesheet-only overrides retain their precedence. These statements use the
existing consumer inventory; unavailable downstream checkouts have not been
reverified.
