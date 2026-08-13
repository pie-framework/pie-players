---
"@pie-players/pie-theme": patch
"@pie-players/pie-theme-daisyui": patch
---

Resolve DaisyUI's palette to PIE tokens a learner can see, from one table instead
of four copies.

The same 47-row slot-to-token table was written out four times: the provider
adapter in `@pie-players/pie-theme`, `mapDaisyThemeToPieVariables` and
`mapResolvedDaisyThemeToPieVariables` in `@pie-players/pie-theme-daisyui`, and that
package's `bridge.css`. Two defects lived in the drift between them, and the parity
test meant to catch drift compared only which token names each copy declared, never
which slot a token derived from.

`DAISYUI_PIE_TOKEN_MAP` in `pie-theme` is now the single table, and one renderer
serves all three JS mappers. `bridge.css` cannot import it, so the parity test now
holds it to the table expression by expression. Three copies of the table are gone.

## An unanswered question was painted as a wrong one

`--pie-missing` and `--pie-incorrect` both resolved to `--color-error`, so under
every DaisyUI theme an unanswered question and a wrong one were the same colour.
`--pie-missing` now takes `--color-warning`, the mapping the rest of PIE already
declares: pie-elements-ng keys it to `warning`, and the assessment toolkit's
`.pie-warning` rule paints it.

## Feedback marks and control boundaries were unreadable

DaisyUI's semantic slots are background colours — `--color-success` is chosen to
sit behind `--color-success-content` — while PIE paints `--pie-correct`,
`--pie-incorrect` and `--pie-missing` as `color:`. Taken verbatim, the correct mark
measured 1.26:1 against the page under `acid` and 1.96:1 under `light`, against SC
1.4.3's 4.5:1.

`--pie-border` and `--pie-button-border` have the same shape of problem against SC
1.4.11's 3:1. They map to `--color-base-300`, a surface tint, so a boundary painted
with it sits between 1.09:1 and 1.53:1 across the shipped themes. What makes that a
defect rather than a subtle divider is that `--pie-button-bg` resolves to
`--color-base-100`, the page's own colour: for a toolbar button, an answer-eliminator
toggle, or the inline TTS control, that border is the only thing separating the
control from the page behind it. `--pie-border-dark` is corrected too, since
`--color-neutral` collapses to 1.09:1–1.85:1 against the page in dark themes, taking
the graph tool's grid lines with it.

The repo already had one component routing around this: the annotation toolbar was
given its own contrast-checked border token because, as the note in
`color-schemes.css` puts it, `--pie-border` "carries a surface tint that leaves the
outline at ~1.1:1". Correcting the token means the next component does not need its
own escape hatch.

Both corrections go through `legibleColorAgainst`: the slot untouched when it
already clears its minimum against `--color-base-100`, otherwise the largest 5%
share of it that does, mixed toward `--color-base-content`. Mixing toward the
theme's own text colour borrows the theme's guarantee — base-content is what that
theme chose to be readable on that surface — so one code path lightens a mark in a
dark theme and darkens it in a light one. Stepping down from the top keeps as much
hue as the threshold allows: 36 of the 84 theme/slot feedback combinations need no
correction and keep their exact colour.

`--pie-border-light` is deliberately left alone. It is the token the players use for
card edges and pane dividers, which 1.4.11 exempts, and a 3:1 outline around every
item card would be a visual regression rather than a fix. The `-secondary` tints are
untouched for the same reason: they are fills, and what has to contrast with them is
the text on top.

## Measuring

Contrast is measured by painting one pixel on a canvas and reading it back. DaisyUI
5 resolves its palette in `oklch()`, and an oklch-to-sRGB implementation in this
package would be a second opinion about colours the browser has already decided.

Where the values are not measurable colours — `mapDaisyThemeToPieVariables` emits
`var()` references, `bridge.css` is static CSS, and a server render has no canvas —
the correction falls back to a fixed hue share: 30% for the 4.5:1 targets and 35%
for the 3:1 ones, each the largest 5% step that clears its threshold for every
affected slot in all 28 shipped themes. Deliberately pessimistic: a slot that needed
no correction still gets pulled most of the way to the text colour.
