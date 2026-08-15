---
"@pie-players/pie-section-player": patch
---

Keep the passage/questions toggle's unselected label legible under every color
scheme.

`--pie-section-player-tab-color` is a host hook, and its fallback was the literal
`#111827`. No theme token sat in that chain, so a host that does not set the hook
got near-black ink whatever the scheme resolved to: 1.18:1 against the track under
White on Black, and the same collision under Yellow on Blue and Yellow on Navy.
The hook now falls back through `--pie-text`, which is the certified
ordinary-text pair against the track's `--pie-background` and measures at or above
6.2:1 across the ten built-in schemes.

The track's boundary keeps `--pie-border-gray`, which already clears 3:1 in every
scheme and is stepped to that minimum under the DaisyUI provider. Its literal
moves from `#D9DADA` to `#767676`: the literal only reaches a host that mounts the
player with no theme at all, where the old value left the track at 1.2:1 against
the frame.

A Playwright case walks the toggle through all ten schemes and asserts both the
label and the boundary, and refuses to run against a route with no theme host —
the unthemed `/tabbed-layout/*` routes resolve every token to its literal, which
would pass the loop without measuring a scheme at all.
