# @pie-players/pie-tool-calculator-shared

## 0.3.75

### Patch Changes

- c6b509c: Each section-player input has one tier: `nds-icons`, `locale` and `tool-config-strictness` are layout attributes only, and `assessmentId`, `onFrameworkError`, `onStageChange`, `onLoadingComplete` and tool config are `runtime` keys only, so a host that sets `assessment-id` or a callback property on a layout element moves it into `runtime`. The toolkit's `pnp-enforcement` attribute is gone; set `tools.pnpEnforcement`. Layout elements drop `selectComposition`, `selectNavigation`, `selectReadiness` and the readiness-phase types; read `getSnapshot()` and listen for `pie-stage-change`. The section player's entries are the root, `./browser`, the splitpane component subpath, `./contracts/runtime-host-contract`, `./contracts/host-hooks`, `./policies` and `./item-section`; a host importing another component subpath imports the root. The layout-contract constants, `SECTION_PLAYER_PUBLIC_EVENTS`, `isPreloadEnabled` and `isTelemetryEnabled` are removed; read `resolveSectionPlayerPolicies(policies)`. The toolkit's `./runtime/engine` no longer exports `createReadinessDetail`, `resolveOnFrameworkError`, `DEFAULT_ASSESSMENT_ID` or `EffectiveRuntime`.
  
  `ToolkitCoordinatorApi` drops `getServiceBundle`, `getInitStatus`, `isToolEnabled`, `registerToolContextResolver` and `setToolContextResolvers`, and the toolkit element drops `getServiceBundle()`; read the coordinator's service properties, `isReady()` and `getToolConfig()`, and pass resolvers as `runtime.toolContextResolvers`. A host-supplied coordinator must implement `onReadyChange`. `ToolkitInitStatus` and `ToolkitServiceBundle` are removed. `createEmptyPersonalNeedsProfile` moves to `@pie-players/pie-default-tool-loaders`, which drops `registerPackagedTools`, `registerDefaultToolModuleLoaders`, `PACKAGED_TOOL_ORDER`, `PACKAGED_TOOL_PLACEMENT`, `UNIVERSAL_SUPPORTS_PRESET` and the re-exported `ToolModuleLoader`. The policy source-tag types, `ToolPolicyEntry.sources` and `ToolPolicyDiagnostic.source` are removed; a decision's `rule` and a diagnostic's `details` carry attribution, and `"tts"` is no longer special-cased as a tool id. A profile's `prohibitedSupports` now outranks item and district requirements, so PNP precedence is one order: district block, `false` override, item restriction, prohibition, `true` override, item requirement, district requirement, profile support. `stimulusRefs` is removed from the shared types, and `toolConfigs` and `toolParameters` are object-valued records. `@pie-players/pie-tool-calculator-shared` drops its root entry; import `/calculator-element`. The PNP debugger and TTS settings panels dispatch `close` from the host element, without bubbling.
  
  Text-to-speech names a server provider one way: `backend: "server"` with `serverProvider: "polly" | "google" | "custom"`, so a host setting `backend: "polly"` or `"google"` moves the name to `serverProvider`, and a string `provider` is rejected. Keys nested under `settings` are no longer read; move them, `mathSpeech` included, to the top level. `TextToSpeechToolProviderConfig` is closed and exported in place of `ToolConfig` and `TTSToolConfig`. `TTSFeature` and `ITTSProvider.supportsFeature` are removed; a custom provider deletes the method. `DEFAULT_TTS_SPEED_OPTIONS`, `normalizeTTSSpeedOptions`, `resolveRuntimeProvider`, `resolveTTSBackend`, `resolveTransportMode` and `BrowserVoiceTraits` leave `./tools/registration`. `TtsServiceApi.onStateChange(callback)` returns its unsubscribe function and `offStateChange` is removed, and `bindTtsAudioHandoff` drops `listenerId`. A custom highlight coordinator implements `highlightTTSWordElement` and `highlightTTSSentenceElements`; `clearAll` leaves the interface. `TTSService.initialize` rejects when its provider fails to start, and the coordinator owns the browser fallback, reported as `pie-tool-init-fallback`. `<pie-tool-tts-inline>` defaults `layoutMode` to `left-aligned`, and reads `--pie-button-border` and `--pie-button-hover-bg` in place of `--pie-button-border-color` and `--pie-button-hover-background-color`. The annotation toolbar offers read-aloud only when a toolbar hosts `textToSpeech`. `--pie-background-light` leaves the theme token registry, the assessment player's navigation reads `--pie-background` in its place, and the dictionary and picture-dictionary panels read `--pie-secondary-background`. `PieThemeTokenScope` drops `"unsupported"` and `PieThemeTokenStatus` drops `"intentional-gap"`, which no entry uses.
- 240f300: `<pie-item-shell>` is removed. Section-player item cards render `<pie-item-scope>`, the toolkit's item element, which now takes `region-policy`; `data-pie-shell-root="item"` and the card's classes are unchanged, so a host selecting the tag selects `pie-item-scope` instead. The theme's font-size rules scale `pie-item-scope`, around a host's own item player too.
- 57a8d50: `updateToolConfig` replaces the tool's provider even when the provider id stays the same, so a new `provider.init` or `provider.runtime.authFetcher` takes effect; an open calculator remounts on the new provider. After a text-to-speech reconfigure the next speak starts the reconfigured provider, also under `lazyInit`. Registering a provider under an id that is already registered now replaces it.
- bcba901: `toolOverrides` applies as documented, the policy engine compares its inputs structurally, an embedded toolkit keeps the assessment its host bound, and the PNP debugger no longer overwrites settings. A toolbar that cannot load a tool's module withholds the tool and reports `tool-module-load`, fatal only when policy grants it; the inline calculator opens through its item's toolbar and only where that toolbar offers the calculator; GeoGebra calculators show their attribution; tool windows stack within their tool's z-index layer while the ToolCoordinator leaves display to the renderer; and element tool state ids containing `:` round-trip.
- 36e2770: `pie-assessment-toolkit` takes `isolation` as an attribute, and a `coordinator` passed to a nested toolkit wins over the outer one's. The calculator starts its provider under the toolkit's tool failure policy. Selection read-aloud and math control names take the content language, `en-US` unless markup or the host names another. A toolkit without a section starts its coordinator at the first item scope that registers, rebuilds it from inputs changed before then and reports later changes, and adopts a `toolRegistry` set after mount in place; the toolbar's empty-registry warning waits 10 s for one.
- d9f56e8: The toolkit root exports 185 names instead of 326: the names only tool packages use moved to `./tools/registration`, and the names nothing imports are removed, among them the backend activity-session adapters, the item loader and the session-storage helpers. The TypeScript examples in the READMEs match the current API.
- 5b15d5c: Tool elements read the toolkit's services from the runtime context only, so the calculator, annotation toolbar, answer eliminator and sign-language elements drop their coordinator, service and `providerId` properties. Providers register under their tool's id (`calculator`, `textToSpeech`), and the toolkit reports a tool by that id as `toolId` only: lifecycle hooks pass it as their first argument, `ToolkitErrorContext.providerId` becomes `toolId`, and `ProviderLifecycleContext.providerId`, `ToolConfigDiagnostic.providerId` and the `providerId` telemetry repeated beside `toolId` are removed. `ToolProviderApi.providerId`, `getProviderId`, `resolveToolProviderId`, `ToolkitCoordinator.getToolProvider` and `AnswerEliminatorToolConfig` are removed, and `sanitizeConfig` / `validateConfig` move from the provider descriptor to `ToolRegistration`.
- 4e9f832: An open calculator remounts on a provider that a tool-config update replaces, answer eliminations are kept per element, toolbar-seeded tools release their coordinator entries, and one `<pie-tool-calculator>` element and one loader set serve every calculator provider and host shape. Removed: the toolkit's `./tools/client` subpath, `connectAssessmentToolkitRuntimeContext`, `connectAssessmentToolkitShellContext` and `connectAssessmentToolkitRegionScopeContext` (use the `connectTool…` functions), the singular `toolComponentFactory` override, `ToolCoordinator.resetZIndices`, the loader options `calculatorProviderConfig`, `createDefaultToolModuleLoaders`, `createSectionToolModuleLoaders`, `ITEM_TOOL_MODULE_LOADERS`, `SECTION_TOOL_MODULE_LOADERS` and `registerSectionToolModuleLoaders` (use `DEFAULT_TOOL_MODULE_LOADERS` and `tools.providers.calculator`), the `pie-tool-calculator-geogebra`, `-cortex`, `-inline-geogebra` and `-inline-cortex` packages (use `<pie-tool-calculator>` and `<pie-tool-calculator-inline>`), and the answer eliminator's `globalElementId` prop, replaced by `elementStateKeys`; `ToolbarContext.getGlobalElementId` now takes the element id.
- Updated dependencies [d58f703]
- Updated dependencies [3f3eb08]
- Updated dependencies [7cf309e]
- Updated dependencies [7400511]
- Updated dependencies [14e53c9]
- Updated dependencies [53940c9]
- Updated dependencies [6b26e88]
- Updated dependencies [f5465e5]
- Updated dependencies [8edca42]
- Updated dependencies [c6b509c]
- Updated dependencies [6ee4cb8]
- Updated dependencies [1025fba]
- Updated dependencies [db280dd]
- Updated dependencies [296055c]
- Updated dependencies [6f57b31]
- Updated dependencies [ad05203]
- Updated dependencies [240f300]
- Updated dependencies [4e9913f]
- Updated dependencies [cdc3dd7]
- Updated dependencies [dcc7375]
- Updated dependencies [7c162ea]
- Updated dependencies [78491f2]
- Updated dependencies [0e00095]
- Updated dependencies [7aeddb9]
- Updated dependencies [d36dbae]
- Updated dependencies [57a8d50]
- Updated dependencies [3ac0028]
- Updated dependencies [3ac0028]
- Updated dependencies [d7c46ac]
- Updated dependencies [bb9c165]
- Updated dependencies [699f1c6]
- Updated dependencies [d2de576]
- Updated dependencies [1ec8e34]
- Updated dependencies [d89f462]
- Updated dependencies [cb93fdd]
- Updated dependencies [cf199c9]
- Updated dependencies [8122e1e]
- Updated dependencies [bcba901]
- Updated dependencies [c5634aa]
- Updated dependencies [f80f159]
- Updated dependencies [36e2770]
- Updated dependencies [9464e2b]
- Updated dependencies [8d94ae3]
- Updated dependencies [d9f56e8]
- Updated dependencies [5b15d5c]
- Updated dependencies [4e9f832]
- Updated dependencies [ccc2765]
- Updated dependencies [fbd4570]
- Updated dependencies [55d97fd]
- Updated dependencies [4d94e9c]
  - @pie-players/pie-assessment-toolkit@0.3.75
  - @pie-players/pie-players-shared@0.3.75
  - @pie-players/pie-calculator@0.3.75

## 0.3.74

### Patch Changes

- 8b24361: Boolean attributes on the custom elements read `"false"`, `"0"`, `"off"` and
  `"no"` as false instead of treating any present value as true, so
  `trust-markup="false"` no longer skips sanitization.
- c4bfe09: `./calculator-element`, which the packaged tool loaders and
  `@pie-players/pie-tool-calculator-desmos` load for the Desmos calculator, now
  bundles its own Svelte runtime. It left `svelte` to the host's bundler, so a
  Svelte host older than 5.57 supplied its own copy and the calculator crashed on
  opening with `(void 0) is not a function`.
- 799b592: The inline calculator buttons stay visible and open the calculator. Placed
  inside `<pie-item-shell>`, a button toggles the item toolbar's calculator,
  `calculator:item:<itemId>`; it used to register itself with the tool
  coordinator, which hid it, and toggle its own id. `target-tool-id` still names
  another calculator id and now defaults to empty on every variant, and the unused
  `tool-id` attribute is gone. With no item shell and no `target-tool-id` the
  button is disabled and logs a console warning.
- 5a0bcb1: The `pie-tool-*` bundles import the toolkit and `pie-players-shared` from the
  host's `node_modules` instead of inlining them, and the section player imports
  `@pie-players/pie-item-player`, so a page with both players defines one
  `pie-item-player` and fetches one MathJax module. The toolkit's `sideEffects`
  lists only its custom elements.
  
  The section player's `./contracts/*` and `./policies` subpaths register no
  element and import in Node. Each exports only its own module's names, so import
  anything else from the package root. `pie-players-shared` drops
  `./server/npm-registry` and `./server/npm-auth-env`.
  `pie-tool-calculator-shared`'s root entry no longer exports the calculator
  shells: it registers `<pie-tool-calculator>`, as `./calculator-element` does,
  and the package no longer depends on `svelte`. `speech-rule-engine` is pinned to
  `5.0.0-rc.4`, whose locale tables the toolkit imports by file path, and math
  rendering imports `@pie-lib/math-rendering-module/module/index.js`, which
  webpack's fully-specified ESM resolution finds.
- 8e13d3d: Scoped CSS class names, and the identifiers the minifier derives alongside
  them, are the same whichever checkout builds the package.
- 598ac56: Published type declarations no longer import `svelte`, which a host without
  Svelte cannot resolve: under `skipLibCheck: false` its type-check failed with
  TS2307.
  
  The section-player debugger and TTS settings panels, `tool-answer-eliminator`,
  the inline calculators and `tool-tts-inline` now declare nothing from their root
  entry, because importing one only registers its element. A TypeScript import of
  the Svelte component that entry default-exports no longer type-checks.
  `section-player-tools-shared` and `tool-calculator-shared` declare their
  exported components without Svelte.
- Updated dependencies [7361295]
- Updated dependencies [040299f]
- Updated dependencies [30a037f]
- Updated dependencies [8b24361]
- Updated dependencies [498f937]
- Updated dependencies [2825bf5]
- Updated dependencies [8b24361]
- Updated dependencies [377146f]
- Updated dependencies [3e88cac]
- Updated dependencies [17afe85]
- Updated dependencies [5fb7902]
- Updated dependencies [3cb91c5]
- Updated dependencies [3ccab31]
- Updated dependencies [b072a44]
- Updated dependencies [0e8e8df]
- Updated dependencies [223f00a]
- Updated dependencies [a3e721c]
- Updated dependencies [05845a3]
- Updated dependencies [adc3da6]
- Updated dependencies [e40a2a6]
- Updated dependencies [39b2c16]
- Updated dependencies [dba059f]
- Updated dependencies [7d99003]
- Updated dependencies [580cc7b]
- Updated dependencies [0d36cde]
- Updated dependencies [a4f73f6]
- Updated dependencies [aa58883]
- Updated dependencies [6859fb7]
- Updated dependencies [435bb29]
- Updated dependencies [fa3ade0]
- Updated dependencies [a0408d4]
- Updated dependencies [f5d1b01]
- Updated dependencies [63b75e6]
- Updated dependencies [549de08]
- Updated dependencies [d860667]
- Updated dependencies [3841938]
- Updated dependencies [9d51813]
- Updated dependencies [2bbda17]
- Updated dependencies [05b698f]
- Updated dependencies [cadfcf9]
- Updated dependencies [a2a97eb]
- Updated dependencies [2be7868]
- Updated dependencies [2084d88]
- Updated dependencies [cd183fa]
- Updated dependencies [a38056b]
- Updated dependencies [140d39b]
- Updated dependencies [da9e2f7]
- Updated dependencies [fbb61b6]
- Updated dependencies [da37ba4]
- Updated dependencies [771def2]
- Updated dependencies [8a8b932]
- Updated dependencies [7bc44f3]
- Updated dependencies [ec632eb]
- Updated dependencies [7c4b13d]
- Updated dependencies [3ddbe89]
- Updated dependencies [a8c0d7f]
- Updated dependencies [8f4b1da]
- Updated dependencies [8b24361]
- Updated dependencies [ff7c2bc]
- Updated dependencies [5a0bcb1]
- Updated dependencies [0bd34af]
- Updated dependencies [8e13d3d]
- Updated dependencies [799b592]
- Updated dependencies [976c4d3]
- Updated dependencies [45bec78]
- Updated dependencies [6e6f883]
- Updated dependencies [6cc239a]
- Updated dependencies [05845a3]
- Updated dependencies [2cd3d03]
- Updated dependencies [3be570a]
- Updated dependencies [b7c9382]
- Updated dependencies [a0e15b9]
- Updated dependencies [60077c2]
- Updated dependencies [22bcd83]
- Updated dependencies [326f382]
- Updated dependencies [4369286]
- Updated dependencies [3d8bb9a]
- Updated dependencies [e25ebc5]
- Updated dependencies [3a01d9b]
  - @pie-players/pie-assessment-toolkit@0.3.74
  - @pie-players/pie-players-shared@0.3.74

## 0.3.73

### Patch Changes

- Updated dependencies [e2fd6b8]
- Updated dependencies [83d30e3]
  - @pie-players/pie-players-shared@0.3.73
  - @pie-players/pie-assessment-toolkit@0.3.73

## 0.3.72

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.72
  - @pie-players/pie-players-shared@0.3.72

## 0.3.71

### Patch Changes

- Updated dependencies [181b124]
- Updated dependencies [69f354e]
- Updated dependencies [6c089fd]
- Updated dependencies [ee795c8]
  - @pie-players/pie-assessment-toolkit@0.3.71
  - @pie-players/pie-players-shared@0.3.71

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
