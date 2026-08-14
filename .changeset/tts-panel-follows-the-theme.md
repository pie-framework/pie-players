---
"@pie-players/pie-tool-tts-inline": patch
---

Paint the inline TTS overlay panel from the active theme instead of the Figma
literals.

The floating and left-aligned panels hardcoded their palette: `#146eb3` media
glyphs and selected-speed text, a `#fff` card, a `#f3f5f7` chip with a `#d9dada`
border, `#5b6b73` unselected labels. Only host-scoped hooks nobody sets stood in
front of those values, so the panel ignored the theme entirely — a DaisyUI
`valentine` page rendered a pink player with a blue TTS panel floating over it,
and every dark theme got the same white card. Each surface now resolves its hook
first, then a canonical token, then the literal as the no-theme last resort. The
NDS trigger glyph, which remapped `--color-interactive-blue` to the same accent,
follows the same chain.

Foregrounds default through `--pie-button-color` rather than an accent token.
`--pie-primary` and `--pie-tertiary` are `direct` mappings of DaisyUI slots
chosen to pair with their own `-content` colour, so a glyph taken from either
measures 1.37:1 against the card under `pastel`, and 11 of the 35 shipped themes
fall under SC 1.4.11's 3:1 — 17 under 1.4.3's 4.5:1 for the selected label.
Tinting an accent toward the text colour does not rescue it either: even a 20%
share leaves `valentine` at 4.13:1 on the chip. `base-content` is the one family
whose contrast against the card DaisyUI guarantees, and the selected-chip fill
takes `--pie-button-active-bg`, which the mapping already tunes to hold
`base-content` at 4.5:1. Selection is signalled by the chip and the bolder
weight rather than by hue; a host that wants a branded accent sets
`--pie-tts-button-color` and owns the contrast.

Two consequences of theming the card. Its background resolves through
`--pie-white`, the theme's opaque page surface, not `--pie-background`, which the
base light theme sets to `rgba(255,255,255,0)` so page content shows through — a
floating card cannot be transparent. And the Figma card is shadow-only with a
black shadow, which leaves no visible edge once the surface goes dark, so the
card now carries a hairline mixed from `--pie-text` that reads on either, with
`--pie-tts-card-border` as the opt-out (`transparent` restores the shadow-only
card). It is not derived from `--pie-border`, since a host that sets that to
transparent for borderless controls is exactly the host whose only card edge is
the shadow.
