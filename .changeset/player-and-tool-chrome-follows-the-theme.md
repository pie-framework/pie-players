---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-tool-calculator-desmos": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-tool-text-to-speech": patch
---

Paint the remaining player and tool chrome from the active theme.

The floating tool shell's header fell back to `#f3f4f6` whenever the host had not
set `--pie-section-player-card-header-background`, which is the normal case, so
the shell's themed title text sat on a light grey strip — 2.3:1 under `pastel`,
worse under the dark themes. It now defaults through `--pie-button-active-bg`,
the mapping's contrast-tuned one-step-off-the-page fill, whose light value is the
`#f3f4f6` that was pinned; the title measures 14.7:1 under `dracula`, 16.0:1 under
`light` and 4.5:1 under `valentine`, and the light theme is unchanged.

The three scrolling panes defaulted `--pie-scrollbar-thumb`,
`--pie-scrollbar-track` and `--pie-scrollbar-thumb-hover` to greys, and nothing
sets those hooks, so a light scrollbar shipped on every dark theme and colour
scheme. Thumb and hover now default through `--pie-border` and
`--pie-border-dark`, which the mapping corrects to 3:1 against the surface, and
the track through `--pie-background-dark`.

Also routed through tokens: the Desmos calculator frame and its loading/error
overlay, the inline calculator's focus ring and glyph colours, the toolkit's
framework-error panel, the item-player build warning, the preview toggle's tabs
and the tool-settings hover tint, which now mixes from `currentColor` so it
tracks whatever header it sits on.

The embedded Desmos canvas stays white by decision: the third-party calculator
paints its own white UI and a themed mount would only band it. The frame around
it follows the theme so the shell's header and window controls read against it.
