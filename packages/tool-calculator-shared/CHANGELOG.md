# @pie-players/pie-tool-calculator-shared

## 0.3.70

### Patch Changes

- Updated dependencies [e8ab025]
- Updated dependencies [9868ee1]
- Updated dependencies [599c657]
- Updated dependencies [e3169f8]
- Updated dependencies [b544a28]
- Updated dependencies [8b4e0e4]
- Updated dependencies [ab1b1a9]
- Updated dependencies [f10fa7d]
- Updated dependencies [3d6acc6]
- Updated dependencies [47ae660]
- Updated dependencies [c9267e5]
- Updated dependencies [da5b9da]
- Updated dependencies [e3169f8]
  - @pie-players/pie-players-shared@0.3.70
  - @pie-players/pie-assessment-toolkit@0.3.70

## 0.3.69

### Patch Changes

- 3017425: Fill the inline calculator trigger from the button tokens, so it is opaque under the base light theme.
  
  `--pie-background` is the page token, which a host may point at its own backdrop, and the base light theme shipped it as `rgba(255,255,255,0)` until the change described in `theme-light-base-background-opaque`. The trigger filled itself from that token, so it rendered transparent with `--pie-text` ink over whatever the host had painted, and the package could make no contrast guarantee. All three inline calculator packages render this shared component, so the transparent trigger shipped in `pie-tool-calculator-inline-cortex`, `-desmos` and `-geogebra` alike.
  
  The resting fill now resolves `--pie-button-background-color` then `--pie-button-bg` then `--pie-white`; hover resolves `--pie-button-hover-background-color` then `--pie-button-hover-bg` then `--pie-secondary-background`. Both canonical tokens are required in each base theme and in all ten colour schemes, so nothing behind them fires under a theme. Every scheme sets `--pie-button-bg` and `--pie-background` to the same page colour, so only the two base themes change: the light base gains an opaque fill, and the dark base gains a visible hover step where the previous pairing was near-flat.
  
  Hosts that set `--pie-background` to give this trigger a fill, including as a workaround for the transparent button, will find that override no longer reaches it. Set `--pie-button-bg`, or `--pie-button-background-color` for this control alone. A host that wants a transparent trigger must now say so explicitly.
  
  One recorded consumer maps `--pie-background` onto its own palette; that mapping no longer reaches this button's fill. The same host already sets `--pie-button-bg` and `--pie-button-background-color` in the same rule, so its rendered result is unchanged.
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
- 8bb668b: Add a separately packaged GeoGebra calculator suite with provider, full tool,
  inline trigger, tests, documentation, and a section-player demo. Basic requests
  map to GeoGebra Scientific, while scientific and graphing use their matching
  embedded apps.
  
  Move calculator lifecycle and UI into a provider-neutral shared package, keep
  vendor settings in their implementation packages, and select implementations
  through the same `provider.init`, `provider.runtime`, and `settings` schema.
  Desmos remains the no-configuration default and preserves its unkeyed legacy
  load and runtime `proxyEndpoint` initialization for existing clients. The
  packaged composition selects the GeoGebra element and lazy bundle from the same
  provider config used by the toolkit.
  
  Document that PIE bundles only MIT-licensed adapter code, not either vendor
  application. Clarify the separate Desmos and GeoGebra license obligations,
  runtime credential boundary, attribution, and self-hosting restrictions.
- 787ad8f: Add a fully bundled open-source calculator provider using MathLive, Cortex
  Compute Engine, and JSXGraph, with basic, scientific, and graphing modes,
  worker-isolated evaluation, accessible graph exploration, direct custom-element
  wrappers, package-owned isolated mode demos, typed English/Dutch localization
  with host message overrides and RTL support, canonical theme-token consumption,
  themeable graph series, and opt-in default-tool-loader composition.
  
  Move registration of the generic `pie-tool-calculator` element into the shared,
  provider-neutral package while retaining the Desmos compatibility entry and
  Desmos as the default provider.
- Updated dependencies [ced07e0]
- Updated dependencies [004d38e]
- Updated dependencies [cb99eae]
- Updated dependencies [8bb668b]
- Updated dependencies [787ad8f]
- Updated dependencies [3544e9d]
- Updated dependencies [6e2d488]
- Updated dependencies [cb99eae]
  - @pie-players/pie-assessment-toolkit@0.3.69
  - @pie-players/pie-players-shared@0.3.69
