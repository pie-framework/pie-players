---
"@pie-players/pie-theme": patch
---

Resolve DaisyUI's feedback slots to colours a learner can see, and stop an
unanswered question sharing a colour with a wrong one.

DaisyUI's semantic slots are background colours: `--color-success` is chosen to
sit behind `--color-success-content`, not to be read against the page — the
`-content` counterparts are the whole point of the pairing. PIE's feedback tokens
are foregrounds; the assessment toolkit paints `--pie-correct`,
`--pie-incorrect` and `--pie-missing` as `color:`. Mapping a slot verbatim
therefore put a pale fill where a legible mark belongs. Measured across DaisyUI's
28 shipped themes, the correct mark reached 1.26:1 against the page under `acid`
and 1.27:1 under `lofi`, against SC 1.4.3's 4.5:1; under `light`, the default, it
sat at 1.96:1.

`--pie-missing` also resolved to `--color-error`, the same slot as
`--pie-incorrect`, so under every DaisyUI theme an unanswered question and a wrong
one were painted identically. It now resolves to `--color-warning`, which is the
mapping the rest of PIE already declares: pie-elements-ng keys `--pie-missing` to
`warning`, and the toolkit's own `.pie-warning` rule paints it.

Each feedback foreground now resolves through `legibleColorAgainst`, which returns
the slot untouched when it already clears 4.5:1 against `--color-base-100`, and
otherwise the largest 5% share of it that does, mixed toward
`--color-base-content`. Mixing toward the theme's own text colour rather than
toward black or white uses the theme's own guarantee — base-content is what that
theme chose to be readable on that surface — so one code path lightens a mark in a
dark theme and darkens it in a light one. Stepping down from the top keeps as much
hue as the threshold allows: 36 of the 84 theme/slot combinations need no
correction and keep their exact colour, the rest keep between 30% and 90% of
theirs, and the worst case across all 28 themes is now 4.51:1.

Contrast is measured by painting one pixel on a canvas and reading it back.
DaisyUI 5 resolves its palette in `oklch()`, and an oklch-to-sRGB implementation
in this package would be a second opinion about colours the browser has already
decided. Where there is no canvas — a server render, a DOM shim in tests — the
correction falls back to a fixed 30% hue share, the largest 5% step that clears
4.5:1 for every slot in every shipped theme. That fallback is deliberately
pessimistic: a slot that needed no correction still gets pulled most of the way to
the text colour.

The `-secondary` tints are unchanged. They are backgrounds, and what has to
contrast with them is the text painted on top.
