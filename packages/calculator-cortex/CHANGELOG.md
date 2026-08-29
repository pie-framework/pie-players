# @pie-players/pie-calculator-cortex

## 0.3.69

### Patch Changes

- 004d38e: Give every calculator the panel size its layout needs, and make the Cortex
  calculator fit the panel it is given instead of clipping.
  
  A graphing calculator has never opened at the size it declares. `ItemToolBar`
  builds a tool shell from the first render and reads `initialWidth` once, but a
  registration that sizes itself from render params sees none on that pass:
  `getToolRenderParams` reads the resolved tool context, which arrives a render
  later. So `calculatorType` was null, the calculator declared its untyped 380px
  panel, and every graphing calculator — Desmos, GeoGebra and Cortex alike — opened
  in a box a third of the width its two-column layout needs, with the plot column
  clipped away. `applyShellStrings` already re-read the title on update, which is
  why the header said "Graphing Calculator" over a panel sized for a basic one. The
  shell now adopts a declared size that changed, and re-places itself because the
  declared size is what `initialAlign` resolved against. A learner's own size wins:
  once the panel has been dragged or resized it is theirs, and a re-render must not
  snap it back.
  
  Panel sizes are now per type, measured rather than assumed — 380x500 basic,
  380x560 scientific, 720x660 graphing. Basic asked for 560 and needed 398px of
  content, and the ~90px of blank above the entry line was that gap. The resize floor stays shared at
  380x480: this registration serves Desmos, GeoGebra and Cortex alike, so a
  graphing-only floor would move the limit under two vendors whose layouts were
  never measured for it. Cortex below 42rem stacks the rail above the plot and needs
  701px there, which no spacing tier closes — it scrolls its own content instead,
  which is the contract every size below the opening one already relies on.
  
  In the Cortex calculator itself, every fixed size is now a token, and the
  calculator measures its own box and re-declares them in three tiers. Keys keep
  the 44px of WCAG 2.5.5 at every size a panel opens at; below that they give up
  height so the keypad keeps its rows, down to 28px, clear of 2.5.8's 24px floor at
  Level AA. The tier is measured with a `ResizeObserver` rather than a
  `container-type: size` query, which carries `contain: layout` and would make the
  calculator the containing block for every fixed-position descendant, MathLive's
  popovers among them. The `@media (max-height: 30rem)` rule this replaces asked the
  viewport, so it never fired for a 406px panel in a 900px window — and the tool
  wrapper's `height: 100% !important` had overridden its effect anyway.
  
  Nothing is clipped now, at any size. Three separate causes: the calculator root
  was pinned to the panel's height inside an `overflow: hidden` wrapper, so the
  shell's own `overflow-y: auto` never saw anything to scroll; the keypad and the
  graphing view's two panels were shrinkable flex items, and a flex item shrunk
  below its content paints outside its box rather than clipping, which is how keypad
  rows came to be drawn over the graph controls; and the plot carried a `width: 100%`
  with a border at `content-box`, overflowing its column by exactly 2px. The root
  now scrolls as the floor case, only the display yields among the rows, and the
  graphing view places the pressure per layout: stacked, the panels hold their
  content and the calculator takes one scroll; side by side they scroll in their own
  columns, so the readout cannot push the plot off the panel. The readout is never
  hidden or truncated either way — the board is `aria-hidden`, so that text is the
  graph for assistive technology and for read-aloud.
  
  `Clear history` rendered 96x20 and was the one control in the tool under 2.5.8's
  24px; it now holds 28px. The keypad layer tabs wrap rather than running off a
  320px panel.
  
  The panel is now drawn as one instrument rather than as controls arranged on a
  card, which is where the remaining space went. The visible `SCIENTIFIC CALCULATOR`
  eyebrow is gone: the tool shell's header already carries that exact string, and a
  second copy of it in a row of its own cost 46px of a 500px panel — a row neither
  reference calculator spends. The heading stays in the tree as visually-hidden
  text, so the region keeps its entry in the document outline. The angle mode moved
  into the display, which has vertical slack a row of its own does not, pinned above
  the tape's scroller so history passes behind it rather than pushing it away. The
  display itself became a screen — a filled surface running to the panel's edges,
  where before it was bare card around a lone bordered mathfield, which is what made
  a 380x500 panel look like it had a hole above the entry line. Layer tabs,
  backspace and clear moved onto the keypad's recessed plane as its head, so the
  bottom of the panel is a single block; the tabs read as a tab strip rather than as
  a row of pills. The keypad calculators drop the root's padding entirely, so screen
  and keypad meet on one rule with no gutters, and the insets that remain are the
  ones inside each surface — `--cortex-tape-inset` and the keypad's inline padding
  are the same value, so the mathfield's text and the first key column share a left
  edge. The mathfield's focus ring is inset now: at full screen width an offset ring
  drew a box around the whole panel instead of around a control. Backspace and clear are icon
  buttons with text accessible names and `title` on both: as two wide labelled buttons
  they were the widest thing on the plane, and neither reference calculator spends a
  bordered button on either. The faces are inline SVG stroked in `currentColor` rather
  than font characters, since `⌫` (U+232B) is the code point least likely to be in a
  host's font stack and a missing glyph renders as a notdef box — a control with no
  legible face. The graphing view's remove-expression button takes the same clear
  icon; the viewport arrows and math signs stay as text, being code points every
  fallback font carries.
  
  In the graphing view the same treatment. The angle mode is declared by the view
  that owns the setting and rendered in the expression rail, the layer tabs sit on
  the keypad's plane, and the expression list became a pane that takes the column's
  slack — sized to its rows it left ~140px of bare card between the keypad and the
  bottom of a 720x660 panel.
  
  The graphing board's `ResizeObserver` resized the board synchronously inside its
  own callback, which raised an unhandled "ResizeObserver loop completed with
  undelivered notifications" on every host page that opened a graphing calculator,
  its `previousSize` guard notwithstanding. It is deferred a frame.
  
  Section-demos gains a dedicated `calculator-desmos` demo, which the default
  provider had never had — it appeared only incidentally in demos about other
  things. It names `calculator-desmos` explicitly and shows the API key arriving
  through `provider.runtime.authFetcher` at open time rather than in item content.
  `SectionDemoRuntimePage` takes a `calculatorConfig` prop instead of keying
  configuration off the provider name, because Desmos is what every other demo gets
  by default and a lockdown keyed on `'desmos'` would have reconfigured the
  calculator in a dozen demos that are about something else; the Cortex demo's
  settings moved to its route with it. That demo deliberately does not set
  `restrictedMode`: the Desmos adapter maps it to `expressions: false` for every
  type, which on a graphing calculator removes the expression list and leaves graph
  paper with no way to enter a function, so the demo locks down through Desmos' own
  `restrictedFunctions` and chrome flags instead.
  
  The panel-fit test compared the root's scroll height against its client height and
  stopped there, which is why it passed while the shipped graphing panel cut off its
  readout: the surplus never reached the root, because the flex items above painted
  outside their boxes instead. It now walks every node, asserts that anything
  overflowing can be scrolled to, that the calculator never scrolls sideways, and
  that no target drops below 24px — at both the size each panel opens at and its
  resize floor. The isolated demo's `shell` size was also one figure for all three
  types and larger than any of them, so the size it measured was not a size that
  ships; it is now per type, with a `Panel minimum` option beside it.
- cb99eae: Give the three calculator adapters one naming and narrowing convention.
  `<Vendor>CalculatorSettings` is the vendor option shape,
  `<Vendor>CalculatorProviderConfig` is `CalculatorProviderConfig` with `settings`
  narrowed to it, and `<Vendor>CalculatorProviderInit` exists only where the
  adapter narrows `CalculatorProviderInit`. Cortex already had all three and is the
  model; the rule is stated on the two contract interfaces so a host reading one
  adapter knows where to look in the others.
  
  GeoGebra's `GeoGebraCalculatorProviderConfig` typed its `initialize()` argument
  while the identically-suffixed Desmos type typed `createCalculator()` -- the same
  name for opposite lifecycles in sibling packages a host picks between. It is now
  `GeoGebraCalculatorProviderInit`, extends `Pick<CalculatorProviderInit,
  "onTelemetry">` rather than redeclaring that callback, and the freed name types
  `createCalculator()`'s argument as it does elsewhere. GeoGebra's embed takes no
  credential, so the narrowing is what says `apiKey` and `proxyEndpoint` cannot be
  honoured there, and narrowing `createCalculator` removed an
  `as GeoGebraCalculatorSettings` cast.
  
  Desmos's `DesmosCalculatorConfig` is renamed `DesmosCalculatorSettings`, since it
  is the settings shape and the other two adapters already said so. It takes
  `CalculatorProviderInit` whole -- Desmos is the one adapter that needs a
  credential -- so it declares no init alias, and the contract records that as the
  rule rather than an omission.
  
  Cortex exported `CortexCalculatorProviderInit` but typed `initialize()` with the
  un-narrowed contract type, so `initialize({ apiKey })` compiled against a local
  engine that has nothing to authenticate. The signature now uses the narrowed
  type.
  
  No consumer breaks: verified against all three consumer checkouts on 2026-08-27,
  none of which imports any calculator type, and no checkout offers GeoGebra.
- bacba85: Add a property-based arithmetic corpus suite. The corpus is GSM8K's inline
  calculator annotations (`<<48/2=24>>`) -- expression/result pairs authored to be
  executed by a calculator, over `0-9 + - * / . ( )` alone, which is exactly basic
  mode's capability set. 300 entries are committed; `bun run test:corpus`
  regenerates and runs the full 10770.
  
  It asserts properties, not values, because a fixture of individual expectations at
  that size fails in ways nobody can act on: every outcome is a declared error code
  or an answer and never an undeclared throw, every answer matches its authored
  result numerically, the three capability sets nest so what basic accepts
  scientific and graphing accept identically, and a displayed answer re-entered
  answers itself. Only the second property uses the labels, so the other three
  would hold against any corpus.
- f24e425: Make the Cortex calculator read and behave like a calculator: a display with a
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
- af438ca: Cover the Cortex calculator's own capabilities: the expression policy's input
  and AST budgets, the non-finite and domain error contract, the sampler's
  discontinuity breaks and point-count clamp, the worker seam (timeout, restart,
  death, superseded replies, protocol and instance guards), the controller
  (simultaneous instances, focus and resize requests, history cap, angle mode,
  graph rows, viewport, state round trip and atomic import refusal, telemetry
  privacy), and the MathLive keyboard lease's handover between instances.
  
  Every key the keypad ships is now proved to produce an expression the policy
  accepts and the engine evaluates, and a key with no such proof fails the suite
  — which is how the parenthesis and inverse-trigonometry defects surfaced. Two
  end-to-end tests were added for the keyboard graph trace and for graphing-mode
  telemetry, and one presses `(` and `)` on the shipped keypad and reads the
  answer.
  
  A feature matrix and a set of session journeys cover what a learner enters and
  what the calculator answers: operator precedence, signs, percent, boundary values
  around zero, display formatting at both exponential thresholds, powers and roots,
  logarithms, trigonometry and its inverses in both angle units, factorial,
  constants, every documented graph entry form, domain edges and poles as breaks in
  a curve, viewport-dependent resampling, and the refusals each mode owes. The
  public calculator-forensics expression is among them. The journeys add what a
  single evaluation cannot show: error recovery in place, an angle-mode switch
  mid-problem, history under a long session, and a suspended session resumed into a
  fresh calculator.
- bacba85: Put the commit key on every keypad layer, punctuate a displayed answer for the
  locale, and pin the non-integer factorial.
  
  The commit key was on the numeric layer alone, so a learner who built an
  expression from the scientific or graphing keys had to switch layers back to
  reach a key they could see. Enter always committed, but a pointer or
  switch-access user has no Enter. `withCommit` now appends one to each
  non-numeric layer after pruning — after, because the key requires no capability
  and a layer carrying it as data would survive a host revoking every function on
  it and render as a lone `=`. A new `KeypadKey.column` pins it to the fifth key
  column so it holds the same corner on a short row as on a full one; it replaces
  `span`, which was declared and never read.
  
  A displayed answer now takes the locale's decimal separator, closing a split
  where an `nl-NL` calculator's keypad wrote `1,5`, its mathfield accepted `1,5`,
  and its answer came back `1.5`. `CortexCalculatorLocalization.formatResult`
  applies it at the display boundary only — the live readout, the history tape and
  the screen-reader announcement. `getResult`, the history entries a host reads and
  the serialized state stay `.`-separated, so state saved under one locale is not
  reinterpreted under another. It is a separator swap, not a reformat: handing
  `formatted` to `Intl.NumberFormat` would re-round it to `maximumSignificantDigits`
  and expand `2.432902008e+18` into nineteen digits. The separator resolver moved
  from `mathlive-runtime.ts` to `localization.ts` as `localeDecimalSeparator`, so
  the mathfield, the keypad's separator key and the answer share one source rather
  than two implementations of the same `Intl` probe.
  
  `2.5!` answering `3.32335097` is now pinned as intended: the factorial is the
  Gamma continuation off the integers, which is what Desmos answers and what the
  Compute Engine computes, unlike a handheld's domain error. Still a domain error
  at the negative integers, where Gamma has poles.
  
  The keypad's sizing note cited a 380x372 panel, which no calculator type ships.
  Corrected, along with the reasoning: row count is a layout budget rather than a
  target-size one, so a row costs panel height. Four rows is the budget and the
  graphing layer spends five, carrying the graph keys as well. The e2e panel-fit
  test measured only the layer that opens, so neither function layer had been
  checked against the panel; it now switches to each. The panel sizes themselves,
  and what happens when a layout does not fit one, are the subject of
  `calculator-panel-fit-and-density`.
- af438ca: Answer with the exact value where one exists, and stop showing an answer that
  belongs to a previous expression.
  
  Evaluation went straight to the numeric approximation, which converts degrees to
  radians first: `cos(90°)` answered `6.123233996e-17` and `sin(30°)` answered
  `0.5000000000000008` — the second only looked right at the default 10-digit
  display and read `0.500000000001` at the supported maximum of 12. The Compute
  Engine's exact evaluation is tried first and answers `0` and `1/2`; expressions
  with no exact form, including `sqrt(2)` and `sin(Pi)` in degree mode, still take
  the numeric path.
  
  Exponential display no longer pads the mantissa with digits the result does not
  have: `12345678901234` reads `1.23456789e+13` rather than `1.234567890e+13`.
  Only an all-zero mantissa was trimmed before, so two formats were reachable from
  one formatter.
  
  Editing the expression clears the displayed answer. The result line sits directly
  under the input, so a stale number stood beside fresh input as though it answered
  it. It also restores the result announcement for a repeated answer, which the
  view fires on a change of result and therefore skipped the second time.
- af438ca: Fix four classes of expression the Cortex calculator refused, three of them
  reachable from its own keypad.
  
  Parentheses were rejected in every mode: the Compute Engine parses `(4+5)` as
  `["Delimiter", …]`, which the capability allowlist did not permit, so `(2+3)×4`
  failed while the numeric layer shipped `(` and `)` keys. Implicit multiplication
  was rejected for the same reason — `2x`, `2π`, `3(4+5)` and `2sin(x)` parse to
  `InvisibleOperator` — so `y=3x^2+2x+1`, the ordinary way a polynomial is
  written, could not be graphed. The three inverse-trigonometry keys inserted
  `\sin^{-1}(…)`, which parses to `["Apply", ["InverseFunction", "Sin"], …]`
  rather than to the canonical `Arcsin`, and were refused. Euler's number was
  accepted only under its canonical spelling `ExponentialE`, so both the `e` key
  and the `e^x` key failed, and `e^x` resolved to the `power` capability instead
  of `exponential`.
  
  Grouping and implicit multiplication grant no capability that `Multiply` did
  not; operands are still validated recursively, so a narrowed `allowedFunctions`
  still refuses the functions it excludes. Function application is permitted only
  for the three inverse-trigonometry heads, not for an arbitrary head.
  
  `busy` no longer stays set after a keystroke supersedes a calculation in
  flight. The view announces `calculating` on the transition into busy, so a
  stuck flag silenced that announcement for every later calculation.
- af438ca: Give the graphing calculator keyboard-operable pan, zoom and reset, and make
  reset work at all.
  
  JSXGraph moves its viewport only from pointer bindings — drag, wheel, pinch — so
  a keyboard-only or switch-access learner could read the default window and
  nothing outside it; the keyboard trace moves within the sampled window and
  cannot leave it. Six controls now sit beside `Reset view`, each a real button
  with a text accessible name.
  
  `Reset view` itself never worked. It called `setBoundingBox`, which recomputes
  the units and moves the origin but does not commit, and whose default third
  argument resets the zoom factors — so the next board update recomputed the
  previous window. Every viewport control now calls the board's own navigation
  methods, which are what its (hidden) navigation bar calls.
  
  The keyboard trace advances a fixed fraction of the series rather than one
  sampled point. The sampler takes one point per pixel, up to 1,200, so traversing
  the plot previously cost as many presses as it was wide.
- bacba85: Accept a base-2 logarithm. The Compute Engine parses `\log_{3}(9)` as
  `["Log", 9, 3]`, which the policy already admitted through `Log`, but
  special-cases base 2 into its own `Lb` operator, which was refused -- so every
  base worked except the one a learner reaches for after 10. `Lb` now maps to the
  same `common-log` capability, and a host revoking `common-log` still loses every
  base at once.
  
  Add typing-sequence coverage: an end-to-end test types into the real mathfield
  and asserts only the answer, since what an editor builds from raw keystrokes is
  MathLive's behaviour, while the LaTeX it hands to `validateExpression` is this
  package's seam. The unit scenarios gain grouping, precedence and entry-shape
  cases derived from the public LaTeX corner-case corpora in `mathquill` and
  Doenet's `math-expressions`.
- bacba85: Split base-n logarithms into their own `log-base-n` capability, and add keypad
  keys for a base-n logarithm and a stacked fraction.
  
  `log-base-n` exists because it could not otherwise be declined. The Compute
  Engine parses `\log_{3}(9)` as `["Log", 9, 3]` -- the same operator that carries
  base 10 -- so an arbitrary base was admitted by `common-log` from the beginning
  and a host granting log base 10 had no way to refuse it. Base 2 is spelled
  differently again, `["Lb", 8]`, and was refused outright while every other base
  answered. Revoking `log-base-n` now leaves base 10 and base e working, and
  revoking `common-log` no longer takes base-n with it. It ships in the default
  scientific and graphing sets, matching the reference implementations; basic mode
  has no logarithms at all.
  
  Both new keys go in a fourth row on the scientific layer, within the four-row
  budget that keeps keys at 44px. Each inserts a template with a single
  placeholder, because a second one would be unreachable: `ArrowRight` leaves a
  subscript rather than crossing to the next placeholder, and MathLive binds
  `moveToNextPlaceholder` to Tab, which this keypad spends on being a single tab
  stop. The logarithm's base fills and its argument follows the subscript, and the
  fraction takes what precedes it as the numerator through `#@`, the idiom the
  `nth-root` key already uses.
  
  No sign key. A handheld separates the sign from the subtraction operator because
  there they are different operations; in a mathfield `-` is contextual, so
  pressing Minus on an empty expression negates. That path is now pinned by a test
  rather than assumed.
- af438ca: Restore the page's own mathfield configuration when a Cortex calculator closes.
  
  `MathfieldElement.locale` and `.decimalSeparator` are static properties of the
  element class, so they are shared with every other mathfield on the page. The
  calculator set them and never put them back: a `nl-NL` calculator left every
  later field on the page parsing `,` as the decimal separator after it closed.
  The lease that already existed for MathLive's virtual keyboard now covers them —
  first acquirer captures, each later one takes ownership, only the current owner's
  release restores.
  
  The virtual-keyboard half of that lease is deleted. This package renders its own
  keypad because MathLive's is a viewport-fixed singleton containing no focusable
  elements, and every call site turned the layout swapping off, so the code that
  swapped layouts was unreachable. The `ownKeypad` parameter goes with it.
- 787ad8f: Add a fully bundled open-source calculator provider using MathLive, Cortex
  Compute Engine, and JSXGraph, with basic, scientific, and graphing modes,
  worker-isolated evaluation, accessible graph exploration, direct custom-element
  wrappers, package-owned isolated mode demos, typed English/Dutch localization
  with host message overrides and RTL support, canonical theme-token consumption,
  themeable graph series, and opt-in default-tool-loader composition.
  
  Move registration of the generic `pie-tool-calculator` element into the shared,
  provider-neutral package while retaining the Desmos compatibility entry and
  Desmos as the default provider.
- Updated dependencies [cb99eae]
- Updated dependencies [8bb668b]
- Updated dependencies [3544e9d]
  - @pie-players/pie-calculator@0.3.69
