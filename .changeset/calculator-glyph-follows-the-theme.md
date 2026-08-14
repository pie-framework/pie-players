---
"@pie-players/pie-assessment-toolkit": patch
---

Default the calculator button's glyph to the theme instead of the Figma blue.

`ItemToolBar` remaps the vendored NDS button's `--color-interactive-blue` to
`--pie-calculator-button-color`, a package-private token nothing sets — so the
fallback behind it is what every host renders, and it was the literal `#146eb3`.
A DaisyUI `valentine` toolbar drew a blue calculator icon on a pink surface. The
accent now resolves through `--pie-button-color` (DaisyUI `base-content`) with
the literal kept as the no-theme last resort, matching the chain
`@pie-players/pie-tool-tts-inline` uses for the same NDS remap on its play
trigger.

Not `--pie-primary` or `--pie-tertiary`: both are `direct` mappings of DaisyUI
slots chosen to pair with their own `-content` colour, so a glyph taken from
either measures 1.37:1 against the page under `pastel`, and 11 of the 35 shipped
themes fall under SC 1.4.11's 3:1. `base-content` is the one family DaisyUI
guarantees against the surface. Hosts that want a branded accent keep setting
`--pie-calculator-button-color` and own the contrast.
