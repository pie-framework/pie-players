---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-tts-inline": patch
---

Bridge the vendored NDS icon button's palette to the PIE token families.

`nds-icon-button` paints from the NDS design-system names — `--color-new-gray`,
`--color-primary-white`, `--color-primary-black`, `--color-focus-blue` — and no
PIE theme sets any of them, so the vendored literals were what every host
rendered: a `#f3f5f7` tertiary pill and a `#2b87ff` focus ring under every theme.
Remapping only the glyph made the dark-theme case worse, since a light
`base-content` glyph then sat on that near-white pill and disappeared. Every host
that opts into `nds-icons` saw it: the calculator button, the inline-TTS trigger,
the items-pane scroll-down control and the floating tool shell's window controls.

The tertiary fill now resolves through `--pie-background-dark`, the on-accent
glyph through `--pie-white`, the hover ring through `--pie-text` and the focus
ring through `--pie-button-focus-outline`, each keeping the NDS literal as the
no-theme last resort. Glyph-on-pill measures 14.3:1 under `dracula`, 16.7:1 under
`light`, 17.3:1 under `pastel` and 4.9:1 under `valentine`; the light theme is
visually unchanged, since `--pie-background-dark` resolves to `#ecedf1` against
the `#f3f5f7` it replaces.

The bridge is declared at each element that mounts a button rather than in one
stylesheet: the vendored bundle is a build artifact we do not re-author, and two
of the mounts sit inside a shadow root a document stylesheet cannot reach. The
tool shell's window controls are created imperatively, so the shell element
carries the properties directly — its scoped CSS never matches them.
`check:theme-tokens` now fails if a mount is added without the bridge or if the
copies drift.
