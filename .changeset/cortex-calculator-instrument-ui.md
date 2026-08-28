---
"@pie-players/pie-calculator-cortex": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-default-tool-loaders": patch
---

Make the Cortex calculator read and behave like a calculator: a display with a
running tape, a keypad this package owns, and a layout that responds to its tool
panel rather than to the window.

The layout is now the calculator's own container, not the viewport. The package's
only size rules were `@media (max-width: 48rem)` and `@media (max-width: 20rem)`,
and the shipped tool panel is 380px wide inside a viewport that is typically
1280px — so neither ever fired in production. Measured at the shipped size, the
graphing view's grid stayed at its 34rem floor inside a 333px box and the shell,
which sets `overflow-x: hidden`, clipped the right 229px including most of the
plot, while the view stacked 1032px of content into 372px. Both are container
queries now, and an e2e test asserts every mode fits its panel in both axes.

Basic and scientific gain a keypad; scientific had shipped with no scientific keys
reachable without typing LaTeX. It is this package's keypad — real buttons with
localized names, one tab stop with arrow-key movement, keys gated on
`settings.allowedFunctions`, and function keys on a second layer rather than in
extra rows. MathLive's virtual keyboard is switched off rather than hidden:
verified against 0.110, its keycaps are `div[tabindex="-1"]` with no `role` and its
toggle a `div[role="button"]` with no `tabindex`, so it holds no focusable elements
and cannot be opened or operated by keyboard or switch access at all; under the
previous `"auto"` policy it also auto-showed on any touch-capable device, landing
across the bottom of the assessment instead of inside the tool panel.

Host theming now reaches the tool. Every colour resolves as
`var(--pie-x, var(--cortex-x))` instead of being declared on the calculator
element, where it overrode whatever an ancestor set — which silently defeated all
ten `[data-color-scheme]` PNP palettes for every token except the six series
colours that already used this pattern. Surfaces deliberately avoid
`--pie-background`, which is the page token a host may point at its own backdrop,
and take `--pie-white` and `--pie-background-dark` with
`--pie-calculator-surface{,-raised}` as host hooks. Controls gain hover and active
states, which the package had none of.

Fixes a dark-theme contrast failure in the plot: JSXGraph was initialised with bare
`axis: true` / `grid: true`, so it used its light defaults in every theme and put
black tick labels on a `#1f2937` surface at 1.43:1 with axes at about 2.2:1. Axes,
tick labels and grid are themed from the resolved tokens and re-applied when
`theme: "auto"` follows the OS. The plot div is `aria-hidden`, so axe cannot see
inside it and the contrast is asserted directly.

Also fixed, each found while restructuring:

- Backspace string-sliced LaTeX, turning `\pi` into `\p` and `\sqrt{2}` into
  `\sqrt{2}` before handing it back to MathLive. It now deletes a token.
- A failed calculation left the previous answer on screen next to the `role="alert"`
  contradicting it, with no re-announcement.
- `setAngleMode` terminated the evaluation worker and built a new one. Settings
  already travel with every request and the worker is stateless, so it now updates
  in place; `importState` no longer respawns either.
- The graphing trace's series `<select>` reported no selected option while the
  readout was actively tracing series 1.
- The series toggle announced "Show expression 1, toggle button, pressed" — the name
  asserting the action its own state denied. The colour chip is now the toggle, with
  a static name, `aria-pressed`, and a 44px target.
- `clear()` bumped `focusRequest` but the graphing view never passed it to a field,
  so focus went nowhere after the expression rows unmounted.
- `menuItems = []` left an inert `div[role="button"]` in the field's gutter;
  MathLive re-applies its inline display on every render, so it is hidden through
  the exposed part instead.
- `convertLatexToMarkup` output had no stylesheet, so every superscript rendered on
  the baseline. MathLive's static sheet is now injected alongside its fonts.
- The keyboard lease captured `[]` from MathLive's iframe proxy and restored it on
  release, which would have emptied the top-level keyboard's layouts for every other
  consumer on the page.
- The e2e contrast helper discarded alpha, so it would have scored a transparent
  surface as passing. It now rejects one, and the axe scan runs both themes rather
  than light only.

The tool shell grows to fit a keypad — 420px of height was chosen when this
calculator was a text field and three buttons — and graphing gets the width its
rail and plot both want. `tool-calculator-shared` stops painting a hardcoded white
plate behind the provider's surface.
