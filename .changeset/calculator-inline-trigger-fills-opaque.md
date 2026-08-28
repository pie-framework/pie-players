---
"@pie-players/pie-tool-calculator-shared": patch
---

Fill the inline calculator trigger from the button tokens, so it is opaque under the base light theme.

`--pie-background` is the page token, which a host may point at its own backdrop, and the base light theme shipped it as `rgba(255,255,255,0)` until the change described in `theme-light-base-background-opaque`. The trigger filled itself from that token, so it rendered transparent with `--pie-text` ink over whatever the host had painted, and the package could make no contrast guarantee. All three inline calculator packages render this shared component, so the transparent trigger shipped in `pie-tool-calculator-inline-cortex`, `-desmos` and `-geogebra` alike.

The resting fill now resolves `--pie-button-background-color` then `--pie-button-bg` then `--pie-white`; hover resolves `--pie-button-hover-background-color` then `--pie-button-hover-bg` then `--pie-secondary-background`. Both canonical tokens are required in each base theme and in all ten colour schemes, so nothing behind them fires under a theme. Every scheme sets `--pie-button-bg` and `--pie-background` to the same page colour, so only the two base themes change: the light base gains an opaque fill, and the dark base gains a visible hover step where the previous pairing was near-flat.

Hosts that set `--pie-background` to give this trigger a fill, including as a workaround for the transparent button, will find that override no longer reaches it. Set `--pie-button-bg`, or `--pie-button-background-color` for this control alone. A host that wants a transparent trigger must now say so explicitly.

One recorded consumer maps `--pie-background` onto its own palette; that mapping no longer reaches this button's fill. The same host already sets `--pie-button-bg` and `--pie-button-background-color` in the same rule, so its rendered result is unchanged.
