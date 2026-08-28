# `@pie-players/pie-calculator-cortex`

A fully bundled, open-source basic, scientific, and graphing calculator
implementation for PIE Players. It implements the provider-neutral contracts
from `@pie-players/pie-calculator` using MathLive, Cortex Compute Engine, and
JSXGraph.

```ts
import { CortexCalculatorProvider } from "@pie-players/pie-calculator-cortex";

const provider = new CortexCalculatorProvider();
await provider.initialize();
const calculator = await provider.createCalculator(
  "scientific",
  document.querySelector("#calculator")!,
  {
    locale: "nl-NL",
    theme: "auto",
  },
);
```

The package bundles all runtime code and required assets. It does not require
an API key, CDN, or network connection.

`initialize()` takes `CortexCalculatorProviderInit`, narrowed to `onTelemetry`
for that reason -- there is no credential to supply. `createCalculator()` takes
`CortexCalculatorProviderConfig`, which is the provider-neutral configuration
with `settings` typed as `CortexCalculatorSettings`.

## Isolated demos

Run `bun run --cwd packages/calculator-cortex demo`, then open the basic,
scientific, or graphing page from the mode navigation. Each page mounts one
calculator directly through `CortexCalculatorProvider`; it does not load an
assessment player, toolkit coordinator, or tool wrapper.

The demo controls switch interface language, theme, and text direction by
destroying and recreating only that calculator instance. **Panel size** does not
recreate anything — it resizes the container to the box the tool shell actually
gives the calculator. Check every change at both sizes it offers: *Shipped tool
panel* is what the panel opens at for that type, *Panel minimum* is its configured
resize floor, and the package's size-dependent rules are container queries on width
and density tiers on height, so a fluid demo at 1280px reaches neither.

## Localization

The package ships complete English (`en-US`) and Dutch (`nl-NL`) interface
catalogs. Locale matching is by primary language, so `nl`, `nl-NL`, and
`nl-BE` select Dutch. Other locales fall back to English while still configuring
MathLive, decimal input, locale-aware graph numbers, the decimal separator in a
displayed answer, and writing direction.

One resolver serves the mathfield, the keypad's separator key and the displayed
answer, so an `nl-NL` calculator whose keypad writes `1,5` answers `1,5`. The
locale reaches the display only: `getResult`, the history entries a host reads and
the serialized state stay `.`-separated, so state saved under one locale is not
reinterpreted under another. It is a separator swap rather than a reformat, which
is what keeps `displayPrecision` and an exponential answer like `2.432902008e+18`
intact.

Every package-owned visible string, accessible name, status, and recoverable
error can be replaced with typed per-instance messages:

```ts
await provider.createCalculator("basic", container, {
  locale: "cy-GB",
  settings: {
    messages: {
      basicCalculator: "Cyfrifiannell sylfaenol",
      calculate: "Cyfrifo",
      clear: "Clirio",
    },
  },
});
```

Unspecified messages fall back to the selected built-in catalog, then English.
Message templates retain their named placeholders, such as `{index}`,
`{lineStyle}`, and `{result}`. `settings.direction` defaults to `"auto"`, which
derives `ltr` or `rtl` from the locale; a host may explicitly set `"ltr"` or
`"rtl"` when its language policy requires it.

## Keypad

Basic and scientific render a display and a keypad; graphing puts the keypad in its
expression rail. The keypad is this package's own — real `<button>` elements with
localized accessible names, one tab stop with arrow-key movement inside it, and PIE
tokens throughout.

It is deliberately not MathLive's virtual keyboard, which is switched off entirely
(`mathVirtualKeyboardPolicy = "manual"`) rather than merely hidden. MathLive's is a
viewport-fixed singleton whose keycaps are `div[tabindex="-1"]` with no `role` and
whose toggle is a `div[role="button"]` with no `tabindex`, so it contains no
focusable elements at all and cannot be opened or operated by keyboard or switch
access; under `"auto"` it also auto-shows on any touch-capable device, dropping
itself across the bottom of the assessment rather than inside the tool panel. Its
`container` setter throws inside an iframe, which is how assessments are commonly
delivered.

Keys are gated on `settings.allowedFunctions`, so a host that narrows the set gets a
keypad that cannot offer a key the validator would reject. Basic omits the constants
outright, matching `validateSymbol`. Scientific and graphing put their function keys
on a second layer rather than in extra rows: a row costs about 50px of panel height
at every size that ships, and eight rows in one layer puts the keypad past the
panel's 480px floor. Four rows is the budget; the graphing layer spends five because
it carries the graph keys too. The e2e suite switches to every layer and measures it
at both the size the panel opens at and its resize floor.

The commit key is on every layer, in the same corner. On the numeric layer alone it
was unreachable from the function keys — Enter still committed, but a pointer or
switch-access user has no Enter.

Every key inserts a template with at most one placeholder. A second is
unreachable: `ArrowRight` leaves a subscript or a fraction rather than crossing to
the next placeholder, and MathLive binds `moveToNextPlaceholder` to Tab, which this
keypad spends on being a single tab stop. `nth-root` and `fraction` therefore use
`#@` to take the expression already typed as their second operand, and `log-base-n`
fills its base and lets the argument follow the subscript.

Layouts live as data in `src/keypad-layouts.ts`. Adding a key needs a message key in
both catalogs — `as const satisfies CortexCalculatorMessages` makes that a
compile-time obligation. Where a key's visible label is a word, its accessible name
must contain that word (WCAG 2.5.3, and what voice control speaks): `keySine` is
`"sin, sine"`, not `"sine of"`.

## Fitting the panel

The panel is two surfaces with no card between them: a screen and a console, each
running to its edges. The screen holds the tape, the live expression and the answer,
with the angle mode pinned above its scroller so history passes behind it; the
console is the keypad's recessed plane, carrying the layer tabs and the backspace and
clear icons above the grid — inline SVG in `currentColor`, because `⌫` is the face a
backspace button wants and the code point least likely to be in a host's font stack. Nothing sits on bare card, and the type's name is not drawn — the
tool shell's header already carries it, and a second copy cost 46px of a 500px panel.
It stays as visually-hidden text for the document outline. `--cortex-tape-inset` and
the keypad's inline padding are one value, so the mathfield's text and the first key
column share a left edge.

A tool panel is resizable, so the height available is a runtime fact and every fixed
size in the tool answers to it. `CalculatorView.svelte` measures its own box with a
`ResizeObserver` and stamps `data-pie-density` — `comfortable` at 400px of content
and up, `compact` to 320, `tight` below — and the metrics live as tokens that each
tier re-declares in one place: key and control target sizes, the display's floor,
the result's type size and the board's floor. A `ResizeObserver` rather than a
`container-type: size` query, which carries `contain: layout` and would make the
calculator the containing block for every fixed-position descendant, MathLive's
popovers among them.

Keys hold the 44px of WCAG 2.5.5 at every size a panel opens at, which is what the
tiers are measured against: basic needs 398px of content and scientific 385px, and
both open at more. Below that, keys give up height before the keypad gives up rows —
a row scrolled out of the panel costs a pointer or switch-access learner the key
entirely — and the smallest tier is 28px, clear of 2.5.8's 24px floor at Level AA.

Nothing is ever clipped. The calculator root scrolls its own content as the floor
case; it cannot be left to the tool shell, because the wrapper pins the calculator to
`height: 100% !important` inside an `overflow: hidden` box, so the shell's
`overflow-y: auto` never sees anything to scroll. Above that floor the graphing view
places the pressure deliberately: stacked, the two panels hold their content and the
calculator takes one scroll; side by side they scroll in their own columns instead,
so a readout does not push the plot off the panel. Flex shrinking is what makes this
load-bearing — an item shrunk below its content paints outside its box rather than
clipping, which is how keypad rows were drawn over the graph controls.

## Theming

`theme: "light" | "dark" | "auto"` supplies accessible package defaults.
`"auto"` follows `prefers-color-scheme`.

Those defaults are **fallbacks**, not declarations. Every colour resolves as
`var(--pie-x, var(--cortex-x))`, so a host's tokens reach the tool and the
package's own values apply only where the host has none. This matters beyond
looks: `@pie-players/pie-theme` publishes ten `[data-color-scheme]` PNP palettes
and marks every token used here as `required`, and declaring `--pie-*` on the
calculator element — as this package once did — wins over anything an ancestor
sets, so a learner's colour-scheme accommodation stopped at the calculator's edge.
`tests/calculator-cortex-style-contract.test.ts` fails if such a declaration
returns.

Consumed: `--pie-text`, `--pie-white`, `--pie-background-dark`, `--pie-border`,
`--pie-border-gray`, `--pie-blue-grey-300`, `--pie-button-bg`,
`--pie-button-color`, `--pie-button-hover-bg`, `--pie-button-active-bg`,
`--pie-button-focus-outline`, `--pie-primary`, `--pie-primary-dark`,
`--pie-incorrect`, `--pie-incorrect-secondary`, and `--pie-content-emphasis`.

`--pie-background` is deliberately **not** among them. The canonical light theme
publishes it as `rgba(255, 255, 255, 0)`, and a transparent calculator over
whatever the host painted would take every contrast guarantee out of this
package's hands. Surfaces take `--pie-white` for the card and
`--pie-background-dark` for the recessed keypad plane, both opaque in the base
themes and in all ten schemes. A host wanting different surfaces has package
hooks: `--pie-calculator-surface` and `--pie-calculator-surface-raised`.

`--pie-font-scale` is **not** consumed, matching the recorded decision in
`section-player/tests/content-text-follows-font-scale.test.ts`: the font
accommodation applies to what the learner reads, and a keypad growing with the
passage is a layout problem rather than an accommodation.

Graph colors have package-owned hooks because no canonical series palette
exists: `--pie-calculator-series-1`, `--pie-calculator-series-2`,
`--pie-calculator-series-3`, `--pie-calculator-series-4`,
`--pie-calculator-series-5`, and `--pie-calculator-series-6`. Each series also
has a solid, dashed, or dotted line style; hosts overriding colors must retain
3:1 contrast against the graph surface and keep the palette distinguishable.

The plot's axes, tick labels and grid are themed from the resolved tokens and
re-applied when `theme: "auto"` follows the OS across a change. They have to be:
JSXGraph initialised with bare `axis: true` / `grid: true` uses its light defaults
in every theme, which put black tick labels on a dark plot at 1.43:1. The plot div
is `aria-hidden`, so axe never sees inside it — the contrast is asserted directly
in `e2e/calculator-cortex.spec.ts` instead, tick labels at 4.5:1 as text and axes
at 3:1 as a graphical object.

## Coverage

Feature coverage rests on three suites with different jobs.

`tests/calculator-cortex-keypad-coverage.test.ts` is the self-maintaining one:
every shipped keypad key must map to an expression proven to validate and
evaluate. A key with no entry fails, and an entry naming a retired key fails.
Implicit multiplication, parenthesised groups and the inverse-trigonometric keys
were all refused by the expression policy until this test reached them.

`tests/calculator-cortex-scenarios.test.ts` pins values, traced from the PRD's
capability spec: precedence, boundary values, display thresholds, the domain
edges of every function, and the refusals each mode owes. Its LaTeX entry shapes
are derived from the public corner-case corpora in `mathquill` and Doenet's
`math-expressions`, which test their own parsers — the shapes carry over, the
expectations do not.

`tests/calculator-cortex-corpus.test.ts` covers volume, and asserts properties
rather than values, because a fixture of individual expectations at corpus size
fails in ways nobody can act on. The corpus is GSM8K's inline calculator
annotations — `<<48/2=24>>`, expression/result pairs authored to be executed by a
calculator — over `0-9 + - * / . ( )` alone, which is exactly basic mode's
capability set. Four properties hold: every outcome is a declared error code or an
answer, never an undeclared throw; every answer matches its authored result
numerically, since the annotations carry their author's currency formatting;
capability sets nest, so what basic accepts scientific and graphing accept
identically; and a displayed answer re-entered answers itself. Only the second
uses the labels — the rest would hold against any corpus.

300 entries are committed under `tests/fixtures/`, chosen by a deterministic
stride so regenerating produces no diff. For the full 10770:

```bash
bun run test:corpus
```

Playwright covers what no unit test can reach: what MathLive builds from real
keystrokes. Those tests assert only the answer, because turning `/` into a
fraction is MathLive's behaviour, while the LaTeX it hands to `validateExpression`
is this package's seam — and the two have disagreed, `2x` and `(4+5)` among them.
