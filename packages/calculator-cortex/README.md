# `@pie-players/pie-calculator-cortex`

A basic, scientific and graphing calculator adapter built on MathLive, the
CortexJS Compute Engine and JSXGraph. It implements the provider contract from
[`@pie-players/pie-calculator`](../calculator/README.md) and bundles all runtime
code and assets, so it needs no API key, CDN or network connection. Toolkit hosts
select it with `provider.id: "calculator-cortex"`
([Calculator providers](../default-tool-loaders/README.md#calculator-providers));
hosts that mount a calculator themselves use `CortexCalculatorProvider` directly.
The [Desmos](../calculator-desmos/README.md) and
[GeoGebra](../calculator-geogebra/README.md) adapters implement the same contract.

## Installation

```bash
bun add @pie-players/pie-calculator-cortex
```

## Usage

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

`initialize()` takes `CortexCalculatorProviderInit`, which carries only
`onTelemetry` because there is no credential to supply. `createCalculator()`
initializes the provider on first use. Both fail with `worker-unavailable`
outside a browser, where module workers are unsupported, and after `destroy()`.
Evaluation runs in a Web Worker under the configured time limit.

The calculator implements every optional `Calculator` method. `getValue()`
returns the current input as LaTeX, `evaluate(latex)` returns the formatted
answer with a `.` decimal separator, and the capabilities report history,
graphing and a `maxPrecision` of 21.

## Modes

| Mode | Accepted input |
| --- | --- |
| `basic` | Numbers, `+ − × ÷`, unary negation, parentheses, square root and percent. No constants. |
| `scientific` | Basic plus powers and roots, exponential and logarithms (natural, base 10 and any other base), trigonometric and inverse-trigonometric functions in the configured angle mode, absolute value, factorial, `π`, `e` and scientific notation. |
| `graphing` | Scientific plus the variable `x`, entered as `f(x)` or `y=f(x)`, for up to six expressions with pan, zoom, reset and keyboard tracing. |

Input is checked against the mode's function set after parsing, whichever key or
keystroke produced it. The factorial is the Gamma continuation off the integers,
matching Desmos, and a domain error at the negative integers.

## Configuration

`createCalculator()` takes `CortexCalculatorProviderConfig`: the provider-neutral
config with `settings` typed as `CortexCalculatorSettings`. A value outside its
range rejects `createCalculator()` with `invalid-state`.

| Field | Default | Accepted values |
| --- | --- | --- |
| `locale` | `"en-US"` | A BCP 47 tag; see [Localization](#localization). |
| `theme` | `"auto"` | `"light"`, `"dark"` or `"auto"`; see [Theming](#theming). |
| `restrictedMode` | `false` | See [Restricted mode](#restricted-mode). |
| `settings.angleMode` | `"degree"` | `"degree"` or `"radian"` |
| `settings.calculationPrecision` | `15` | Integer 1–21, in significant digits |
| `settings.displayPrecision` | `10` | Integer 1–12 |
| `settings.historyLimit` | `20` | Integer 0–50; `0` keeps no history |
| `settings.evaluationTimeLimitMs` | `1000` | Integer 100–2000 |
| `settings.allowedFunctions` | The mode's full set | Function ids from the mode's set |
| `settings.allowClipboard` | `true` | Boolean |
| `settings.messages` | Built-in catalog | Partial message overrides; see [Localization](#localization) |
| `settings.direction` | `"auto"` | `"ltr"`, `"rtl"` or `"auto"` |
| `settings.graph.viewport` | `-10` to `10` on both axes | `{ xMin, xMax, yMin, yMax }`, finite, each minimum below its maximum |
| `settings.graph.showAxes` | `true` | Boolean |
| `settings.graph.showGrid` | `true` | Boolean |

The function ids are `square-root`, `power`, `root`, `exponential`,
`natural-log`, `common-log`, `log-base-n`, `sine`, `cosine`, `tangent`,
`inverse-sine`, `inverse-cosine`, `inverse-tangent`, `absolute-value` and
`factorial`. Basic mode's set is `square-root` alone; scientific and graphing
take all fifteen. `allowedFunctions` only narrows the mode's set: an id the mode
lacks is dropped, and an unknown id is rejected. The keypad hides the keys of
removed functions.

## Restricted mode

`restrictedMode: true` blocks copy, cut, paste and the context menu in the
expression input, and forces `allowClipboard` to `false`. No setting relaxes it.
Clipboard blocking follows `restrictedMode` alone; `allowClipboard` is validated
and has no effect of its own. Clipboard policy beyond the input belongs to the
host.

## Limits

| Limit | Value | Error |
| --- | --- | --- |
| Expression input | 1,024 UTF-16 code units | `expression-too-complex` |
| Parsed expression | 256 nodes, depth 32 | `expression-too-complex` |
| Evaluation time | `evaluationTimeLimitMs` | `evaluation-timeout` |
| Worker start | 20 seconds | `worker-unavailable` |
| Graph expressions | 6 | `invalid-state` on import |
| Graph samples | 200–1,200 points per expression, by plot width | — |

A timed-out evaluation terminates the worker, and the next calculation starts a
new one.

## Errors

Failures throw `CortexCalculatorError` with a `code` and a `recoverable` flag.
The calculator shows recoverable errors beside the input and keeps the learner's
edit buffer.

| Code | Raised for | Recoverable |
| --- | --- | --- |
| `invalid-expression` | Input that does not parse or has no finite real result, and a calculation superseded by newer input. | Yes |
| `unsupported-expression` | A command, function or symbol outside the mode's set, or an unsupported calculator type. | Yes |
| `expression-too-complex` | Input over the size limits. | Yes |
| `evaluation-timeout` | An evaluation over the time limit. | Yes |
| `invalid-state` | Invalid settings, a container that is not an element, and a rejected state import. | Yes |
| `worker-unavailable` | No browser or module-worker support, a worker that fails to start or stops, and a destroyed provider or calculator. | No |

## Telemetry

`onTelemetry` receives `pie-tool-operation-start`, `pie-tool-operation-success`
and `pie-tool-operation-error` for each evaluation. The payload carries
`toolId: "calculator"`, `backend: "cortex"`, `calculatorType`,
`operation: "evaluate"`, `duration` on completion and `errorType` (the error
code) on failure. It never carries expressions, results, history, state or graph
coordinates. A throwing or rejecting callback does not affect the calculator.

## State

`exportState()` returns the provider-neutral `CalculatorState` with
`provider: "cortex"`, `value` equal to the current input, `history` capped at
`historyLimit`, and `providerState` in this schema:

```ts
import type { CortexCalculatorStateV1 } from "@pie-players/pie-calculator-cortex";

const providerState: CortexCalculatorStateV1 = {
  schema: "pie-calculator-cortex",
  version: 1,
  type: "graphing",
  angleMode: "radian",
  calculationPrecision: 15,
  displayPrecision: 10,
  inputLatex: "\\sin(x)",
  graph: {
    viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
    expressions: [
      { id: "e1", latex: "\\sin(x)", colorIndex: 0, lineStyle: "solid", hidden: false },
    ],
  },
};
```

`importState()` is atomic: the calculator is unchanged unless the whole state
validates. It rejects with `invalid-state`:

- a `provider` other than `"cortex"`, or a `type` other than the calculator's;
- a `schema` other than `"pie-calculator-cortex"` or a `version` other than `1`;
- a `value` that differs from `inputLatex`;
- a precision outside its range;
- `graph` on a non-graphing state, or none on a graphing one;
- more than six expressions, an `id` that is empty, longer than 128 characters
  or repeated, a `colorIndex` outside 0–5, or a `lineStyle` other than `solid`,
  `dashed` or `dotted`;
- more history entries than `historyLimit`.

A persisted expression or history entry that fails validation rejects the import
with that expression's own error code.

Import restores the angle mode and keeps the calculator's configured precision.
Unknown fields are ignored and not re-emitted. Version 1 has no migration path,
and no state converts to or from another provider. The toolkit's
`<pie-tool-calculator>` does not persist state, so saving and restoring belong to
hosts that drive the adapter directly.

## Localization

The package ships complete English (`en-US`) and Dutch (`nl-NL`) interface
catalogs. Locale matching is by primary language, so `nl`, `nl-NL`, and
`nl-BE` select Dutch. Other locales fall back to English while still configuring
MathLive, decimal input, locale-aware graph numbers, the decimal separator in a
displayed answer, and writing direction.

One resolver serves the mathfield, the keypad's separator key and the displayed
answer, so an `nl-NL` calculator whose keypad writes `1,5` answers `1,5`. The
locale reaches the display only: the value `evaluate()` returns, the history
entries a host reads and the serialized state stay `.`-separated, so state saved
under one locale is not reinterpreted under another. The display swaps the
separator without reformatting, which keeps `displayPrecision` and an exponential
answer like `2.432902008e+18` intact.

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
Unknown keys are ignored. Message templates retain their named placeholders,
such as `{index}`, `{lineStyle}`, and `{result}`. `settings.direction` defaults
to `"auto"`, which derives `ltr` or `rtl` from the locale; a host sets `"ltr"`
or `"rtl"` when its language policy requires it.

## Theming

`theme: "light" | "dark" | "auto"` supplies accessible package defaults.
`"auto"` follows `prefers-color-scheme`.

Those defaults are fallbacks. Every color resolves as
`var(--pie-x, var(--cortex-x))`, so a host's tokens reach the tool and the
package's own values apply only where the host has none. `@pie-players/pie-theme`
publishes ten `[data-color-scheme]` PNP palettes and marks every token used here
as `required`, so the package never declares a `--pie-*` token on the calculator
element: a declaration there would override every ancestor, a learner's
color-scheme accommodation included.
`tests/calculator-cortex-style-contract.test.ts` enforces it.

Consumed: `--pie-text`, `--pie-white`, `--pie-background-dark`, `--pie-border`,
`--pie-border-gray`, `--pie-blue-grey-300`, `--pie-button-bg`,
`--pie-button-color`, `--pie-button-hover-bg`, `--pie-button-hover-border`,
`--pie-button-active-bg`, `--pie-button-focus-outline`, `--pie-primary`,
`--pie-primary-dark`, `--pie-incorrect`, `--pie-incorrect-secondary`,
`--pie-content-emphasis` and `--pie-font-family`.

`--pie-background` is excluded. It is the page token, which a host may point at
its own backdrop or at a translucent value, and resolving the calculator's fill
through it would take every contrast guarantee out of this package's hands.
Surfaces take `--pie-white` for the card and `--pie-background-dark` for the
recessed keypad plane, both opaque in the base themes and in all ten schemes. The
card and keypad surfaces are package-private (`--pie-calculator-surface`,
`--pie-calculator-surface-raised`) and carry no compatibility guarantee.

`--pie-font-scale` is not consumed, matching the recorded decision in
`section-player/tests/content-text-follows-font-scale.test.ts`: the font
accommodation applies to what the learner reads, and a keypad growing with the
passage is a layout problem.

Graph colors have package-owned hooks because no canonical series palette
exists: `--pie-calculator-series-1`, `--pie-calculator-series-2`,
`--pie-calculator-series-3`, `--pie-calculator-series-4`,
`--pie-calculator-series-5`, and `--pie-calculator-series-6`, all registered
`component-public` tokens. Each series also has a solid, dashed, or dotted line
style; hosts overriding colors must retain 3:1 contrast against the graph surface
and keep the palette distinguishable.

JSXGraph's own axis and grid defaults are light in every theme, so the package
themes the plot's axes, tick labels and grid from the resolved tokens and
re-applies them when `theme: "auto"` follows an OS change. The plot is
`aria-hidden`, out of axe's reach, so `e2e/calculator-cortex.spec.ts` asserts its
contrast directly: tick labels at 4.5:1 as text and axes at 3:1 as a graphical
object.

## Keypad

Basic and scientific render a display and a keypad; graphing puts the keypad in
its expression rail. The keypad is this package's own: real `<button>` elements
with localized accessible names, one tab stop with arrow-key movement inside it,
and PIE tokens throughout.

MathLive's virtual keyboard is switched off entirely
(`mathVirtualKeyboardPolicy = "manual"`). Its keycaps are `div[tabindex="-1"]`
with no `role` and its toggle is a `div[role="button"]` with no `tabindex`, so it
cannot be opened or operated by keyboard or switch access. It is a viewport-fixed
singleton that, under `"auto"`, shows on any touch-capable device across the
bottom of the assessment, and its `container` setter throws inside an iframe,
where assessments are commonly delivered.

Keys are gated on `settings.allowedFunctions`, so a narrowed set never offers a
key the validator would reject, and basic omits the constants. Scientific and
graphing put their function keys on a second layer: a row costs about 50px of
panel height at every shipped size, and eight rows in one layer puts the keypad
past the panel's 480px floor. Four rows is the budget; the graphing layer spends
five because it carries the graph keys too. The e2e suite switches to every layer
and measures it at both the size the panel opens at and its resize floor. The
commit key is on every layer, in the same corner, because a pointer or
switch-access user has no Enter key.

Every key inserts a template with at most one placeholder. A second is
unreachable: `ArrowRight` leaves a subscript or a fraction without crossing to
the next placeholder, and MathLive binds `moveToNextPlaceholder` to Tab, which
this keypad spends on being a single tab stop. `nth-root` and `fraction`
therefore use `#@` to take the expression already typed as their second operand,
and `log-base-n` fills its base and lets the argument follow the subscript.

Layouts live as data in `src/keypad-layouts.ts`. Adding a key needs a message key
in both catalogs, which `as const satisfies CortexCalculatorMessages` makes a
compile-time obligation. Where a key's visible label is a word, its accessible
name contains that word (WCAG 2.5.3, and what voice control speaks): `keySine` is
`"sin, sine"`.

## Panel fit

The panel is two surfaces with no card between them, a screen and a console, each
running to its edges. The screen holds the tape, the live expression and the
answer, with the angle mode pinned above its scroller so history passes behind
it. The console is the keypad's recessed plane, carrying the layer tabs and the
backspace and clear icons above the grid, drawn as inline SVG in `currentColor`
because `⌫` is the code point least likely to be in a host's font stack. The
type's name is not drawn, since the tool shell's header already carries it and a
second copy costs 46px of a 500px panel; it stays as visually hidden text for the
document outline. `--cortex-tape-inset` and the keypad's inline padding are one
value, so the mathfield's text and the first key column share a left edge.

A tool panel is resizable, so every fixed size answers to the height available
at runtime. `CalculatorView.svelte` measures its own box with a `ResizeObserver`
and stamps `data-pie-density`: `comfortable` at 400px of content and up,
`compact` to 320px, `tight` below. Each tier re-declares the metrics tokens in
one place: key and control target sizes, the display's floor, the result's type
size and the board's floor. A `container-type: size` query would carry
`contain: layout` and make the calculator the containing block for every
fixed-position descendant, MathLive's popovers among them.

Keys hold the 44px of WCAG 2.5.5 at every size a panel opens at, which is what the
tiers are measured against: basic needs 398px of content and scientific 385px,
and both open at more. Below that, keys give up height before the keypad gives up
rows, because a row scrolled out of the panel costs a pointer or switch-access
learner the key entirely. The smallest tier is 28px, clear of 2.5.8's 24px floor
at Level AA.

Nothing is clipped. The calculator root scrolls its own content as the floor
case, because the wrapper pins the calculator to `height: 100% !important` inside
an `overflow: hidden` box, so the shell's `overflow-y: auto` never has anything
to scroll. Above that floor the graphing view places the pressure: stacked, the
two panels hold their content and the calculator takes one scroll; side by side,
each scrolls in its own column, so a readout does not push the plot off the
panel. The arrangement is load-bearing because a flex item shrunk below its
content paints outside its box without clipping.

## Isolated demos

Run `bun run --cwd packages/calculator-cortex demo`, then open the basic,
scientific, or graphing page from the mode navigation. Each page mounts one
calculator directly through `CortexCalculatorProvider`, without an assessment
player, toolkit coordinator or tool wrapper.

The demo controls switch interface language, theme, and text direction by
destroying and recreating only that calculator instance. **Panel size** resizes
the container to the box the tool shell gives the calculator, without recreating
it. Check every change at both sizes it offers: *Shipped tool panel* is what the
panel opens at for that type, and *Panel minimum* is its configured resize floor.
The package's size-dependent rules are container queries on width and density
tiers on height, which a fluid demo at 1280px reaches neither of.

## Test coverage

Feature coverage rests on three suites with different jobs.

`tests/calculator-cortex-keypad-coverage.test.ts` maintains itself: every shipped
keypad key must map to an expression proven to validate and evaluate. A key with
no entry fails, and an entry naming a retired key fails.

`tests/calculator-cortex-scenarios.test.ts` pins values, traced from the PRD's
capability spec: precedence, boundary values, display thresholds, the domain
edges of every function, and the refusals each mode owes. Its LaTeX entry shapes
are derived from the public corner-case corpora in `mathquill` and Doenet's
`math-expressions`, which test their own parsers; the shapes carry over and the
expectations do not.

`tests/calculator-cortex-corpus.test.ts` covers volume, and asserts properties
because a fixture of individual expectations at corpus size fails in ways nobody
can act on. The corpus is GSM8K's inline calculator annotations (`<<48/2=24>>`,
expression/result pairs authored to be executed by a calculator) over
`0-9 + - * / . ( )` alone, which is exactly basic mode's capability set. Four
properties hold: every outcome is a declared error code or an answer, never an
undeclared throw; every answer matches its authored result numerically, since the
annotations carry their author's currency formatting; capability sets nest, so
what basic accepts scientific and graphing accept identically; and a displayed
answer re-entered answers itself. Only the second uses the labels; the rest would
hold against any corpus.

300 entries are committed under `tests/fixtures/`, chosen by a deterministic
stride so regenerating produces no diff. For the full 10,770:

```bash
bun run --cwd packages/calculator-cortex test:corpus
```

Playwright covers what MathLive builds from real keystrokes, which no unit test
reaches. Those tests assert only the answer: turning `/` into a fraction is
MathLive's behavior, while the LaTeX it hands to `validateExpression` is this
package's seam, and the two have disagreed, `2x` and `(4+5)` among them.

## Exports

| Export | Kind |
| --- | --- |
| `CortexCalculatorProvider` | The `CalculatorProvider` implementation (`providerId: "cortex"`). |
| `CortexCalculatorError`, `CortexCalculatorErrorCode` | Error class and its code union. |
| `cortexEnglishMessages`, `cortexDutchMessages` | The built-in message catalogs. |
| `localeDirection(locale)` | The `ltr` or `rtl` direction the package derives from a locale. |
| `CortexCalculatorProviderInit`, `CortexCalculatorProviderConfig`, `CortexCalculatorSettings`, `CortexGraphSettings`, `CortexGraphViewport`, `CortexAngleMode`, `CortexFunctionId`, `CortexTextDirection` | Configuration types. |
| `CortexCalculatorMessages`, `CortexCalculatorMessageKey`, `CortexCalculatorMessageOverrides` | Message types. |
| `CortexCalculatorState`, `CortexCalculatorStateV1`, `CortexGraphState`, `CortexGraphExpressionState`, `CortexGraphLineStyle` | State types. |

## License

MIT. `LICENSE.md` lists the bundled MathLive, CortexJS Compute Engine and
JSXGraph with their licenses.
