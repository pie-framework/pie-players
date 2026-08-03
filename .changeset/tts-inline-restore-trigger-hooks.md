---
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-theme": patch
---

Make the documented active/open trigger hooks work again in the inline TTS tool.

`README.md` documents `--pie-tool-trigger-active-background`, `-color` and
`-border-color` as the supported way to style the trigger while its panel is
open, instead of overriding broad tokens such as `--pie-primary`. The component
referenced none of them, so a host following the documentation got no effect.
PIE-727 added these hooks for exactly this control; they were lost in a later
refactor, and the stale registry metadata pointing at this package is what
surfaced it.

All three now apply while `aria-expanded="true"`, which the markup already
maintains.

Each hook falls back to the value the control already resolves to, so setting
none of them leaves the trigger looking identical open and closed. That is
deliberate: unlike the calculator's equivalent hooks, this trigger has never had
a filled active look — the panel opening is itself the state indication — and
introducing one would restyle a shipped control for every host. The README
previously claimed the unset default derived from `--pie-primary`, which had
never shipped here; it now describes the actual fallbacks.

Verified in Chromium by comparing the three properties as sRGB bytes rather than
as computed-style strings, since routing an identical value through one more
`var()` layer changes the colour space Chromium serialises to. With the hooks
unset, open matches closed exactly. With them set, all three take effect, and
they stop applying once `aria-expanded` goes false.

The token registry regains this package in `definedIn` for the three hooks.
