---
"@pie-players/pie-section-player-tools-shared": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/pie-item-player": patch
---

Put the debug and inspection panels on the `--pie-*` contract.

Every panel read DaisyUI's own `--color-*` slots — `--color-base-100`,
`--color-base-200`, `--color-base-300`, `--color-base-content`, `--color-primary`
and the state slots. That is the supported flow reversed: DaisyUI is meant to feed
`--pie-*` through pie-theme's provider, and a component reading the slots directly
follows the host's DaisyUI palette, or its own light literals where the host has
none, but never the colour scheme the tester selected. Inspecting a section under
White on Black meant a white panel over a dark page. Several surfaces were mixed
toward `white` explicitly, so they stayed light however the slot resolved.

Panel surfaces are now `--pie-text` on `--pie-background-dark`, the pair the
contract certifies for a recessed surface. Not `--pie-background`, which is what
`--color-base-100` maps to: a floating panel needs an opaque surface, and the light
Base Theme sets `--pie-background` to `rgba(255, 255, 255, 0)` so a host's own
backdrop shows through. Panel chrome — headers, buttons, tabs, table headers, code
blocks — takes the `--pie-button-*` family, with `--pie-button-active-bg` kept
paired with `--pie-button-color` since that is the only ink certified against it.

Selected and destructive states moved from tinted fills to the boundary, so labels
sit on a certified pair: `--pie-incorrect` for destructive, `--pie-missing` for
warning, `--pie-tertiary` for informational, each of which clears 4.5:1 against the
page on every scheme and so passes the 3:1 a boundary owes. Two literals stay by
design and are documented where they sit: drop shadows, and the TTS modal's scrim,
which recedes the page behind it and would wash it out if it followed an ink that
inverts to white under a dark scheme.

A source guard holds the boundary — no panel may read a DaisyUI slot or paint a
colour with no `--pie-*` token — and a Playwright case checks that the tokens
resolve to something legible once a panel is mounted in a themed page. Its
load-bearing assertion is that the surface differs between a light and a dark
scheme: the contrast ratios passed on the old version too, because the panel was
white on both.
