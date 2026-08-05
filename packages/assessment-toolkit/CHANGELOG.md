# @pie-players/pie-assessment-toolkit

## 0.3.63

### Patch Changes

- @pie-players/pie-calculator@0.3.63
- @pie-players/pie-calculator-desmos@0.3.63
- @pie-players/pie-context@0.3.63
- @pie-players/pie-players-shared@0.3.63
- @pie-players/pie-tts@0.3.63
- @pie-players/tts-client-server@0.3.63

## 0.3.62

### Patch Changes

- c73c995: Give the annotation toolbar outline and the annotation underline their own contrast-checked tokens, so neither depends on a token that cannot satisfy WCAG 2.2 SC 1.4.11.

  ## Toolbar outline

  The floating toolbar's stroke is the only boundary between it and the content
  behind it, so it has to clear 3:1 against both. It was derived from
  `--pie-border`, which cannot carry that: the DaisyUI bridge maps that token to
  `--color-base-300`, a surface tint rather than a boundary colour — `#eeeeee` at
  1.16:1 on the light base, `#15191e` at 1.12:1 on the dark one.

  The outline now reads a new `--pie-tool-annotation-toolbar-border`, defaulting to
  a measured `light-dark(#5c5c5c, #949494)` pair — dark grey on light surfaces,
  light grey on dark ones.

  Both arms are measured against the surfaces the toolbar is actually drawn on
  rather than against pure white and pure black. Real theme bases are off-white and
  off-black, and a grey chosen at the edge of passing against an extreme drops under
  threshold on everything else: across DaisyUI's 21 light and 14 dark themes, every
  light surface needs a grey no lighter than `#828282` and every dark surface one no
  darker than `#878787`. Those ranges are disjoint, so one value cannot serve both
  and `light-dark()` is the mechanism. `#5c5c5c` holds 5.22:1 as its worst case on
  the light surfaces and `#949494` holds 3.56:1 on the dark ones.

  `@pie-players/pie-theme` then hands the last word back to palettes that do choose
  a boundary colour deliberately:

  - `[data-theme="dark"]` and `pie-theme[theme="dark"]` pin the dark arm,
    `#949494`. `light-dark()` keys off the declared `color-scheme`, which pie-theme
    does not set, so without this a pie-theme dark page would take the light arm.
  - All ten `data-color-scheme` accessibility palettes map the outline to their own
    `--pie-border`, which each picks for maximum contrast against its own
    background. This rule sits after the dark rule deliberately — the two have
    equal specificity and a scheme can be active on a dark page. The schemes are
    named rather than matched with a bare `[data-color-scheme]`, so an unknown id
    cannot pull in the `:root` values (`--pie-border` is `#9a9a9a`, which misses 3:1
    on white).

  - Each palette also fixes which underline value applies. The underline default is
    selected by `[data-theme]`, which reports what the _page_ declares rather than
    which scheme is active — so a host declaring itself light while running a dark
    scheme pinned the light value over a dark background.

    The colours themselves were never the problem, so they are unchanged: `#4221d5`
    and `#9c89ec` clear 3:1 between them on nine of the ten backgrounds, and each
    scheme is simply given the arm that suits its own. Both states get that one
    value, because within a scheme the background is fixed regardless of what
    `data-theme` reports. Worst case is 4.33:1 (`light-gray-on-dark-gray`).

    `yellow-on-navy` is the sole exception: its `#33508a` background is mid-tone and
    neither arm reaches 3:1 (1.10 light, 2.71 dark), so there alone the underline
    defers to the palette's own `--pie-primary` (`#ffff99`, 7.54:1) — the same
    deference the outline makes to `--pie-border`.

    All three tokens are declared in both delivery routes: per scheme in
    `color-schemes.ts`, so `<pie-theme scheme="…">` applies them as inline styles
    with no CSS import, and in `color-schemes.css` for hosts that set
    `data-color-scheme` themselves.

  `--pie-tool-annotation-toolbar-border` is registered as a `component-public`
  token. Hosts overriding it must keep 3:1 against both the toolbar surface and the
  content behind it.

  ## Annotation underline

  `::highlight(annotation-underline)` took its colour from `--pie-primary`, a theme
  accent chosen against one background and therefore illegible on the other. It now
  reads `--pie-annotation-underline` (default `#4221d5`) and
  `--pie-annotation-underline-dark` (default `#9c89ec`). One value cannot serve
  both: `#4221d5` is 2.41:1 on black and `#9c89ec` is 2.85:1 on white. Each state
  gets its own token so overriding one never silently moves the other, and so
  either can beat a host-set `--pie-primary` — a `var()` fallback can never
  override a value the host actually set.

  The `prefers-color-scheme` media query only reports the OS preference, which is a
  guess at what the page is showing. Three mutually exclusive `[data-theme]` rules
  now override it: explicit `light` and `dark` take the matching default, and any
  other value — including DaisyUI theme ids — follows that theme's accent, falling
  back to the light default. All three carry attribute selectors, so they outrank
  the bare rules including the one inside the media query, whatever the source
  order.

  ## Upgrade note

  Two host overrides stop having their old effect, which is the point of the change
  rather than a side effect of it:

  - Setting `--pie-border` no longer recolours the annotation toolbar outline; set
    `--pie-tool-annotation-toolbar-border`.
  - Setting `--pie-primary` no longer recolours the annotation underline; set
    `--pie-annotation-underline` and `--pie-annotation-underline-dark`. A host that
    declares `data-theme` with neither token set still follows its accent.

- 507b56f: Restore dark-mode, high-contrast, print, and reduced-motion styling for TTS and annotation highlights.

  `HighlightCoordinator` injects the `::highlight()` rules for TTS read-along and
  student annotations. A second copy of those rules also existed as
  `packages/tool-annotation-toolbar/highlights.css`, imported with a plain CSS
  import that never reached the page: the package builds with Vite in library
  mode, so the import was extracted to a `dist` stylesheet the built JS never
  referenced and no `exports` entry exposed.

  The two copies had diverged in both directions. The injected copy had gained
  newer TTS work (`--pie-tts-line-highlight`, element-level fallbacks, an orange
  swatch) while never having the media-query blocks the file carried. So at runtime
  annotation highlights had no dark-mode or high-contrast treatment, printing did
  not strip transient TTS highlighting or convert annotation fills to underlines,
  and reduced-motion did not drop highlight text shadows.

  Those blocks now live with the rules they modify, covering all five annotation
  swatches including orange. Two corrections were made rather than copying the old
  file forward:

  - The recovered stylesheet used `@media (prefers-contrast: high)`. `high` is not
    a valid value for that feature (the keywords are `no-preference`, `more`,
    `less`, `custom`), so an invalid query evaluates to `not all` and the block
    could never have matched in any browser even had the file loaded. It is now
    `more`.
  - The TTS dark-mode and high-contrast blocks were dropped rather than restored.
    They varied only a `var()` fallback, and `applyAdaptiveTTSStyle()` writes
    `--pie-tts-*` inline on `documentElement` on every paint, so those fallbacks
    can never apply. TTS contrast adaptation is handled by that adaptive path.

  `highlights.css` and its dead import are removed. Its `.pie-sr-only` and
  focus-visible rules were already defined in the toolbar component's own `<style>`
  block, where they do take effect.

- a1edde5: Minify and code-split the assessment toolkit custom-element bundles. The three CE artifacts are now produced by a single bundler invocation that shares code through `dist/components/chunks/`, so the Svelte runtime, services layer, and policy engine are no longer duplicated per artifact, and `SectionToolBar` no longer inlines a second copy of `ItemToolBar`. Splitting also restores the lazy `speech-rule-engine` boundary that `math-speech.ts` already asked for: it moves to a chunk fetched only when math speech runs, instead of being flattened into the eager bundle. Eager CE bytes drop from 1,993 KB to 346 KB, and the section player's main bundle drops from roughly 2.6 MB to 1.4 MB. Entry filenames, the `exports` map, and per-entrypoint custom-element registration side effects are unchanged.
- 7864f66: Declare the toolkit's two optional peer packages as devDependencies so the build graph orders them before its own `tsc`.

  `assessment-toolkit` type-imports `@pie-players/pie-calculator-desmos` and
  `@pie-players/tts-client-server` at the dynamic-import sites in
  `DesmosToolProvider` and `TTSToolProvider`. Both were declared only as optional
  `peerDependencies`, which states the consumer contract but is not a build-graph
  edge: only `dependencies` and `devDependencies` order one workspace package's
  build after another's.

  turbo 2.9 happened to derive task-graph edges from `peerDependencies` too, so the
  ordering held by accident. turbo 2.10 stopped, turning the toolkit's build into a
  race against those two packages that fails whenever its own `tsc` wins:

  ```
  src/services/tool-providers/DesmosToolProvider.ts(135,34): error TS2307:
    Cannot find module '@pie-players/pie-calculator-desmos'
  ```

  Both packages are now also devDependencies, so the ordering is explicit and holds
  under either turbo version. The `peerDependencies` and `peerDependenciesMeta`
  entries are unchanged, so consumers still see both as optional peers, and the
  runtime load path is untouched. A standalone build of just this package in a fresh
  checkout now works too.

  `check:deps` grew a `workspace-build-edge` rule that fails when a package imports a
  workspace package it declares only as a peer or optional dependency, so this cannot
  regress silently.

- 3b4e461: Keep every runtime dependency external in the assessment toolkit's custom-element build, and stop publishing sourcemaps.

  Inlining a dependency into a prebuilt custom-element chunk creates a copy a consumer's bundler cannot deduplicate, because its module id is the chunk file rather than the dependency's path in `node_modules`. `speech-rule-engine` was reaching the section player twice for exactly that reason — once through `services/tts/math-speech.js` and once inside the prebuilt chunk — about 1.3 MB of duplicate payload. Externalizing the manifest's dependencies collapses that to one copy. It asks nothing new of consumers: these artifacts already emitted bare `@pie-players/*` specifiers, so they always required a bundler or an import map.

  Publishable packages ship only `dist`, so a usable sourcemap also required `inlineSources`, which embedded every TypeScript source into the tarball. That cost roughly 2.5 MB across the tsc-built packages while every Vite-built package in the repo already shipped none. Sourcemaps are now off everywhere.

- 7605500: Update `speech-rule-engine` from 5.0.0-rc.1 to 5.0.0-rc.4 (current latest).

  Spoken output is unchanged. Verified by diffing both installed copies across 88 outputs — 22 MathML shapes covering fractions, roots, powers, matrices, integrals, sums, Greek, inequalities, percents, absolute values and decimals, against both locale/domain pairs the toolkit derives (`en`/clearspeak and non-English/mathspeak), in both `none` and `ssml` markup modes. Every output matched byte for byte, so the cached-speech key in `generated-speech/math-speech-cache.ts` is deliberately left alone: bumping it would invalidate every cached spoken string in the field for no behavioural reason.

- Updated dependencies [14666b3]
- Updated dependencies [001486e]
- Updated dependencies [6a18f3c]
- Updated dependencies [3b4e461]
  - @pie-players/pie-players-shared@0.3.62
  - @pie-players/pie-calculator@0.3.62
  - @pie-players/pie-calculator-desmos@0.3.62
  - @pie-players/pie-tts@0.3.62
  - @pie-players/tts-client-server@0.3.62
  - @pie-players/pie-context@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-calculator@0.3.61
- @pie-players/pie-calculator-desmos@0.3.61
- @pie-players/pie-context@0.3.61
- @pie-players/pie-players-shared@0.3.61
- @pie-players/pie-tts@0.3.61
- @pie-players/tts-client-server@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-calculator@0.3.60
- @pie-players/pie-calculator-desmos@0.3.60
- @pie-players/pie-context@0.3.60
- @pie-players/pie-players-shared@0.3.60
- @pie-players/pie-tts@0.3.60
- @pie-players/tts-client-server@0.3.60

## 0.3.59

### Patch Changes

- Add an opt-in `nds-icons` flag so hosts can render the vendored `<nds-icon-button>` per environment. Enable it with the `nds-icons` attribute on a section-player element (`<pie-section-player-splitpane nds-icons={true}>`, and likewise on `-vertical`, `-tabbed`, and `-base`) or via `runtime.ndsIcons: true`. When on, the toolbar tool buttons, the calculator shell controls, the inline-TTS play/pause trigger, and the section scroll-hint render as NDS icon buttons; the flag flows through the toolkit runtime context. It defaults to off, so unless a host explicitly opts in these controls render as plain `<button>`s.
  - @pie-players/pie-calculator@0.3.59
  - @pie-players/pie-calculator-desmos@0.3.59
  - @pie-players/pie-context@0.3.59
  - @pie-players/pie-players-shared@0.3.59
  - @pie-players/pie-tts@0.3.59
  - @pie-players/tts-client-server@0.3.59

## 0.3.58

### Patch Changes

- Updated dependencies [8df52bf]
- Updated dependencies [d5cc905]
  - @pie-players/pie-players-shared@0.3.58
  - @pie-players/pie-calculator@0.3.58
  - @pie-players/pie-calculator-desmos@0.3.58
  - @pie-players/pie-context@0.3.58
  - @pie-players/pie-tts@0.3.58
  - @pie-players/tts-client-server@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.57
  - @pie-players/pie-calculator-desmos@0.3.57
  - @pie-players/pie-context@0.3.57
  - @pie-players/pie-players-shared@0.3.57
  - @pie-players/pie-tts@0.3.57
  - @pie-players/tts-client-server@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.56
  - @pie-players/pie-calculator-desmos@0.3.56
  - @pie-players/pie-context@0.3.56
  - @pie-players/pie-players-shared@0.3.56
  - @pie-players/pie-tts@0.3.56
  - @pie-players/tts-client-server@0.3.56

## 0.3.55

### Patch Changes

- Updated dependencies [7f45877]
  - @pie-players/pie-players-shared@0.3.55
  - @pie-players/pie-calculator@0.3.55
  - @pie-players/pie-calculator-desmos@0.3.55
  - @pie-players/pie-context@0.3.55
  - @pie-players/pie-tts@0.3.55
  - @pie-players/tts-client-server@0.3.55

## 0.3.54

### Patch Changes

- bead424: Make inline TTS speed controls a single-select radio-style group with visible Normal selected by default, while preserving host ordering and numeric helper compatibility.
  - @pie-players/pie-calculator@0.3.54
  - @pie-players/pie-calculator-desmos@0.3.54
  - @pie-players/pie-context@0.3.54
  - @pie-players/pie-players-shared@0.3.54
  - @pie-players/pie-tts@0.3.54
  - @pie-players/tts-client-server@0.3.54

## 0.3.53

### Patch Changes

- @pie-players/pie-calculator@0.3.53
- @pie-players/pie-calculator-desmos@0.3.53
- @pie-players/pie-context@0.3.53
- @pie-players/pie-players-shared@0.3.53
- @pie-players/pie-tts@0.3.53
- @pie-players/tts-client-server@0.3.53

## 0.3.52

### Patch Changes

- 905080d: Add a runtime TTS highlight target resolver so hosts can remap spoken ranges to visible highlight targets while PIE Players keeps default identity highlighting, painting, and cleanup.
- Updated dependencies [017f5a9]
  - @pie-players/pie-players-shared@0.3.52
  - @pie-players/pie-calculator@0.3.52
  - @pie-players/pie-calculator-desmos@0.3.52
  - @pie-players/pie-context@0.3.52
  - @pie-players/pie-tts@0.3.52
  - @pie-players/tts-client-server@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.51
  - @pie-players/pie-calculator-desmos@0.3.51
  - @pie-players/pie-context@0.3.51
  - @pie-players/pie-players-shared@0.3.51
  - @pie-players/pie-tts@0.3.51
  - @pie-players/tts-client-server@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.50
  - @pie-players/pie-calculator-desmos@0.3.50
  - @pie-players/pie-context@0.3.50
  - @pie-players/pie-players-shared@0.3.50
  - @pie-players/pie-tts@0.3.50
  - @pie-players/tts-client-server@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.49
  - @pie-players/pie-calculator-desmos@0.3.49
  - @pie-players/pie-context@0.3.49
  - @pie-players/pie-players-shared@0.3.49
  - @pie-players/pie-tts@0.3.49
  - @pie-players/tts-client-server@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0c20d0f]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.48
  - @pie-players/pie-calculator@0.3.48
  - @pie-players/pie-calculator-desmos@0.3.48
  - @pie-players/pie-context@0.3.48
  - @pie-players/pie-tts@0.3.48
  - @pie-players/tts-client-server@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.47
  - @pie-players/pie-calculator-desmos@0.3.47
  - @pie-players/pie-context@0.3.47
  - @pie-players/pie-players-shared@0.3.47
  - @pie-players/pie-tts@0.3.47
  - @pie-players/tts-client-server@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.46
  - @pie-players/pie-calculator-desmos@0.3.46
  - @pie-players/pie-context@0.3.46
  - @pie-players/pie-players-shared@0.3.46
  - @pie-players/pie-tts@0.3.46
  - @pie-players/tts-client-server@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- fd140a3: TTS: generate spoken math as SSML for SSML-capable providers (PIE-623)

  The generated (no authored `accessibilityCatalogs`) math speech path can now
  emit Speech Rule Engine SSML to providers that voice it, while keeping the same
  confidence-gated highlighting and plain-text behavior everywhere else.

  - `@pie-players/pie-tts`: `TTSProviderCapabilities` gains an optional
    `supportsSSML` flag. It is optional and defaults to `false`, so existing
    provider implementations are unaffected.
  - `@pie-players/tts-client-server`: `ServerTTSProvider.getCapabilities()` now
    reports `supportsSSML`. It is conservative — `true` only for the SSML-reliable
    `pie` transport backends (Polly, Google) and `false` for the `custom`
    transport and unknown providers.
  - `@pie-players/pie-assessment-toolkit`: the speech composition core assembles a
    DOM-free plan and, for SSML-capable providers, sends SRE SSML for math
    segments with a plain-text speak-time fallback if a provider rejects it. The
    browser Web Speech provider always receives plain text.
  - `@pie-players/pie-assessment-toolkit`: fixed word/token-level highlighting for
    generated math SSML. Provider word boundaries on a generated math chunk (raw
    SSML in `speechText`, no catalog span alignment) are now mapped from
    raw-SSML offsets back into spoken-text space, so per-token tracking works the
    same as the authored-SSML path instead of falling back to whole-formula
    block highlighting.
  - `@pie-players/pie-assessment-toolkit`: strip the leading `<?xml …?>` prolog
    from Speech Rule Engine SSML so SSML-capable providers (AWS Polly, Google),
    which require the payload to begin with `<speak>`, accept the generated math
    SSML.

- Updated dependencies
- Updated dependencies [fd140a3]
  - @pie-players/pie-calculator@0.3.45
  - @pie-players/pie-calculator-desmos@0.3.45
  - @pie-players/pie-context@0.3.45
  - @pie-players/pie-players-shared@0.3.45
  - @pie-players/pie-tts@0.3.45
  - @pie-players/tts-client-server@0.3.45

## 0.3.44

### Patch Changes

- Lockstep release covering develop since 0.3.42:

  - PIE-548: Integrate `<nds-icon-button>` for the calculator icon in `ItemToolBar`.
  - PIE-565: Add `splitPaneInitialPassageWidth` prop to section-player layout components (split-pane / tabbed / vertical).
  - PIE-553: Section-demos keyboard-navigation demo page; align `partLabels` default with KC.
  - Test stability: audit and wire package test coverage; stabilize item-source-editor and section TTS e2e flows; keep item-player test mocks in sync.

  Note: 0.3.43 was published manually from feat/PIE-546 without merging back to develop. This release re-issues the develop branch onto npm at 0.3.44 and brings local manifests back in sync with the published lockstep version.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.44
  - @pie-players/pie-calculator-desmos@0.3.44
  - @pie-players/pie-context@0.3.44
  - @pie-players/pie-players-shared@0.3.44
  - @pie-players/pie-tts@0.3.44
  - @pie-players/tts-client-server@0.3.44

## 0.3.42

### Patch Changes

- 6496dda: Add host tool context resolvers so integrations can attach per-item render params, such as calculator type, after policy and PNP gates but without overriding packaged tool registrations.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.42
  - @pie-players/pie-calculator-desmos@0.3.42
  - @pie-players/pie-context@0.3.42
  - @pie-players/pie-players-shared@0.3.42
  - @pie-players/pie-tts@0.3.42
  - @pie-players/tts-client-server@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.41
  - @pie-players/pie-calculator-desmos@0.3.41
  - @pie-players/pie-context@0.3.41
  - @pie-players/pie-players-shared@0.3.41
  - @pie-players/pie-tts@0.3.41
  - @pie-players/tts-client-server@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [3a167a8]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.40
  - @pie-players/pie-calculator@0.3.40
  - @pie-players/pie-calculator-desmos@0.3.40
  - @pie-players/pie-context@0.3.40
  - @pie-players/pie-tts@0.3.40
  - @pie-players/tts-client-server@0.3.40

## 0.3.39

### Patch Changes

- 0072fad: Move Svelte out of published runtime dependencies and add a release check that rejects future accidental `svelte` runtime dependency declarations. Assessment toolkit custom-element outputs now bundle their Svelte runtime helpers so consumers do not install a second Svelte runtime through player packages.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0072fad]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.39
  - @pie-players/pie-calculator@0.3.39
  - @pie-players/pie-calculator-desmos@0.3.39
  - @pie-players/pie-context@0.3.39
  - @pie-players/pie-tts@0.3.39
  - @pie-players/tts-client-server@0.3.39

## 0.3.38

### Patch Changes

- ef29724: Rename generic QTI policy APIs and diagnostics to PNP/profile terminology, including the built-in policy source, default enforcement helpers, provenance tags, and required-tool diagnostics.

  Enhance the editable PNP debugger and section demos so hosts can exercise all available tools and PNP/profile enforcement behavior end-to-end.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [f856362]
- Updated dependencies [c8d46d7]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.38
  - @pie-players/pie-calculator@0.3.38
  - @pie-players/pie-calculator-desmos@0.3.38
  - @pie-players/pie-context@0.3.38
  - @pie-players/pie-tts@0.3.38
  - @pie-players/tts-client-server@0.3.38

## 0.3.37

### Patch Changes

- 2818f93: Remove unused `TypedEventBus` from the public API.

  `TypedEventBus` was a generic ~80-LOC `EventTarget` wrapper exported as a "building block" that nothing inside the toolkit used. The toolkit's actual event surfaces deliberately rely on different patterns:

  - Controller streams use `controller.subscribe(listener)` returning a disposer and dispatching a strongly-typed discriminated union (`SectionControllerEvent`).
  - `ToolkitCoordinator.subscribeSectionEvents` / `subscribeItemEvents` / `subscribeSectionLifecycleEvents` use the same disposer + filtered fan-out shape.
  - `FrameworkErrorBus` is a hand-rolled bus with a documented contract (synchronous fan-out, listener isolation, snapshot iteration, idempotent unsubscribe, no replay) — guarantees `EventTarget` does not provide.
  - `I18nService` uses a plain `Set<() => void>` and intentionally does not bubble through the DOM.
  - DOM `CustomEvent`s on `<pie-assessment-toolkit>` cover host-facing communication and are typed via the constants in `runtime/registration-events.ts`.

  ### BREAKING CHANGE (typed integrations only)

  `TypedEventBus` is no longer exported from `@pie-players/pie-assessment-toolkit`. Hosts that imported it can drop in any of:

  - A bare `EventTarget` + `CustomEvent` (the wrapper added almost nothing on top).
  - A small bus library (`mitt`, `nanoevents`, etc.) — equivalent shape, more familiar to most teams.
  - A purpose-built listener `Set` plus a typed `subscribe(listener)` disposer pattern, which is what the toolkit's own services do.

  No replacement is shipped; the export is removed outright because there were no internal call sites and the public-facing surface was already documented as "exported as a building block, not used internally" in both the package README and the marketing docs.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.37
  - @pie-players/pie-calculator-desmos@0.3.37
  - @pie-players/pie-context@0.3.37
  - @pie-players/pie-players-shared@0.3.37
  - @pie-players/pie-tts@0.3.37
  - @pie-players/tts-client-server@0.3.37

## 0.3.36

### Patch Changes

- 9ef211c: PIE-512 Phase D cleanup: drop prior `sectionId` / `attemptId` args from internal subscribe call sites; sharpen the migration narrative for typed integrations.

  This is a follow-up to `0.3.35` — same active-cohort contract, no functional behavior change. It cleans up internal code that was still passing the now-ignored args, and adds an explicit migration recipe for typed integrators.

  ### BREAKING CHANGE (re-stated from `0.3.35` for clarity)

  `coordinator.subscribeSectionEvents` / `subscribeItemEvents` / `subscribeSectionLifecycleEvents` no longer accept `sectionId` / `attemptId` arguments at the type level. The runtime silently ignores any extra unknown properties, so untyped or loosely-typed call sites continue to work, but **typed integrations that import `SectionEventSubscriptionArgs`, `SectionItemEventSubscriptionArgs`, or `SectionScopedEventSubscriptionArgs` directly and pass `sectionId` / `attemptId` will fail to compile against `>=0.3.35`.**

  #### What this changes for typed integrations

  | Before (`<0.3.35`)                                                                            | After (`>=0.3.35`)                                                                                                       |
  | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
  | `subscribeItemEvents({ sectionId, attemptId, listener })`                                     | `subscribeItemEvents({ listener })`                                                                                      |
  | Listener bound to one controller; manual re-subscribe needed on cohort change                 | Listener follows the active cohort automatically; single subscribe survives navigation                                   |
  | `subscribe*` was a no-op when called with an unknown `sectionId`                              | `subscribe*` throws if **no** active cohort exists; call it after the first `getOrCreateSectionController(...)` resolves |
  | Subscribing the same listener function with different filter args added a second subscription | Subscribing the same listener function replaces the prior subscription (filter args from the second call win)            |
  | Listener throws bubbled up to the dispatcher and could break fan-out                          | Listener throws are caught and `console.warn`-logged; fan-out to other listeners continues                               |

  #### Action required

  - **Drop** `sectionId` / `attemptId` from every `subscribeSectionEvents`, `subscribeItemEvents`, `subscribeSectionLifecycleEvents` call site. The args have no runtime effect under `>=0.3.35`.
  - **Move the subscribe call** to _after_ the first `getOrCreateSectionController(...)` resolves (rather than synchronously on `toolkit-ready`).
  - **Remove any re-subscribe-on-navigation logic.** A single subscribe call after the first controller-resolve is sufficient — the listener migrates automatically and gets a snapshot replay (`content-loaded` × N then `section-loading-complete`) on every cohort transition. **This is the most common breakage pattern**: hosts that previously detached and re-subscribed on every `toolkit-ready` (correct under the pre-Phase D pinned-subscription contract) will now observe **double snapshot replays** on every section navigation — once via Phase D auto-migration, then again from the manual re-subscribe. Listener handlers that are not strictly idempotent will fire twice (e.g. analytics `pageAction`s, increment counters that aren't Set-deduplicated, side-effecting hydration calls).
  - **For intentionally-pinned subscriptions to a non-active section** (e.g. a host UI that wants to keep watching section A while displaying B), use `coordinator.getSectionController({ sectionId, attemptId })` and subscribe directly on the controller handle via `controller.subscribe?.(...)`. That binding is pinned to one controller instance and does not migrate.
  - **Hand-rolled local structural types** that duplicate the public arg shape: drop the `sectionId` / `attemptId` properties from the local type so the local declaration matches the public contract. Otherwise the local type is misleadingly-wrong dead code at runtime.

  #### Concrete simplification example

  If your wrapper used the pre-Phase D detach-and-re-subscribe pattern on every `toolkit-ready` event:

  ```typescript
  public handleToolkitReady(event: Event): void {
    const coordinator = (event as CustomEvent).detail?.coordinator;
    if (!coordinator) return;

    // Pre-Phase D: rebind for the new section.
    this.controllerUnsubscribe?.();
    const itemUnsub = coordinator.subscribeItemEvents({
      sectionId: this.sectionId, // pinned to currently-displayed section
      listener: handleItemEvent,
    });
    const sectionUnsub = coordinator.subscribeSectionLifecycleEvents({
      sectionId: this.sectionId,
      listener: handleSectionEvent,
    });
    this.controllerUnsubscribe = () => { itemUnsub?.(); sectionUnsub?.(); };
  }
  ```

  …simplify to subscribe **once** and let Phase D follow the active cohort:

  ```typescript
  public handleToolkitReady(event: Event): void {
    const coordinator = (event as CustomEvent).detail?.coordinator;
    if (!coordinator) return;
    this.toolkitCoordinator = coordinator;

    // Phase D: subscribe once; the listener follows the active cohort
    // across all subsequent navigation. Bail if already subscribed.
    if (this.controllerUnsubscribe) return;

    const itemUnsub = coordinator.subscribeItemEvents({
      listener: handleItemEvent,
    });
    const sectionUnsub = coordinator.subscribeSectionLifecycleEvents({
      listener: handleSectionEvent,
    });
    this.controllerUnsubscribe = () => { itemUnsub?.(); sectionUnsub?.(); };
  }
  ```

  The full migration recipe with before/after code samples is in `packages/assessment-toolkit/README.md` under "Migrating from `<0.3.35`".

  ### Internal cleanup

  Drops `sectionId` / `attemptId` from:

  - `packages/section-player-tools-event-debugger/EventPanel.svelte` — local `ToolkitCoordinatorLike` structural type and the two coordinator subscribe call sites.
  - `packages/section-player-tools-session-debugger/SectionSessionPanel.svelte` — same shape.
  - `packages/section-player/tests/section-player-pie-512-cross-section-events.spec.ts` — the `EventPanelHandle` type and the in-page subscribe call sites.

  These were dead-args at runtime under Phase D — the runtime ignores them, but their presence was misleading: the local types claimed args that the public API no longer accepts, and any future maintainer copy-pasting from those panels would write code that's TS-broken against the public types. No test or behavior change; the cleanup is purely contract-shape hygiene.

  Also fixes a single overlooked `sectionId,` arg in `docs/section-player/client-architecture-tutorial.md` (post-0.3.35 doc-sweep straggler) and adds explicit migration notes to `packages/assessment-toolkit/README.md` and `packages/section-player/README.md`.

  ### Coverage

  No new tests — this is a code-shape cleanup of internal call sites. Coverage for the Phase D contract itself is in:

  - `packages/assessment-toolkit/tests/pie-512-phase-d-active-cohort-tracking.test.ts` (12 cases)
  - `packages/assessment-toolkit/tests/runtime/adapter/coordinator-bridge-cohort-handoff.test.ts` (3 cases)
  - `packages/assessment-toolkit/tests/pie-512-cross-section-event-delivery.test.ts` (3 cases)
  - `packages/section-player/tests/section-player-pie-512-cross-section-events.spec.ts` (Playwright e2e, narrow-viewport A→B→A traversal)

  All pass with the cleanup applied.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.36
  - @pie-players/pie-calculator-desmos@0.3.36
  - @pie-players/pie-context@0.3.36
  - @pie-players/pie-players-shared@0.3.36
  - @pie-players/pie-tts@0.3.36
  - @pie-players/tts-client-server@0.3.36

## 0.3.35

### Patch Changes

- 286418e: fix(PIE-512): make `subscribeSectionEvents` follow the active section cohort across navigation (Phase D)

  Phase B/C addressed engine-side replay and same-section `updateInput` regressions but
  left a final residual flake: `coordinator.subscribeItemEvents` and
  `coordinator.subscribeSectionLifecycleEvents` bound a listener to the section
  controller that was active **at subscribe time**. A host that subscribes once
  on `toolkit-ready` and then navigates between sections — without re-subscribing
  — stayed pinned to the original controller and silently missed `content-loaded`
  / `section-loading-complete` events from the new cohort. Demos that remounted
  the layout custom element on navigation (via `{#key}` or equivalent) avoided
  the bug; a host that keeps the element persistent (the supported pattern) hit
  it on every cross-section navigation.

  ### What changes

  - `subscribeSectionEvents`, `subscribeItemEvents`, and
    `subscribeSectionLifecycleEvents` now bind to the toolkit's _active section
    cohort_ and automatically migrate across cohort transitions. On every
    migration the listener is detached from the old controller, attached to the
    new one, and replayed the new cohort's snapshot (`content-loaded` × N in
    registration order, then `section-loading-complete` if applicable) — the
    same ordering a fresh subscriber would have observed.
  - `subscribeSectionEvents` now throws when no active cohort exists; host code
    must call `getOrCreateSectionController(...)` at least once before
    subscribing. (`toolkit-ready` alone is not sufficient.) The typical
    pattern is a single subscribe right after the first
    `getOrCreateSectionController(...)` resolves — that subscription then
    follows all subsequent navigation without further wiring.
  - Subscribing the same listener function twice replaces the prior
    subscription (filter args from the second call win); the dedup key is
    listener identity alone, no per-section key.
  - A listener that throws is caught and `console.warn`-logged; the throw does
    not interrupt fan-out to other listeners (matches the
    `FrameworkErrorBus` isolation pattern).
  - `SectionEventSubscriptionArgs`, `SectionItemEventSubscriptionArgs`, and
    `SectionScopedEventSubscriptionArgs` no longer declare `sectionId?` /
    `attemptId?` properties. **Type-level breaking change** for consumers
    importing these types directly. Runtime tolerates extra unknown
    properties, so existing call sites that still pass `sectionId` /
    `attemptId` continue to run unchanged — the args are simply ignored
    and the subscription follows the active cohort.
  - `getSectionController({ sectionId, attemptId })` is **unchanged**; it is
    still keyed by id and remains the right call when reading state from
    inactive (persisted) sections.

  ### Why this is expected to be the final pass on PIE-512

  - Removes the only remaining subscribe-time staleness path. No new corner-case
    branches, no timing dependency, no flag — single canonical contract.
  - Coordinator-side dead code (`resolveSectionSubscriptionEntry`,
    `resolveSectionControllerForSubscription`,
    `detachSectionEventSubscriptionsForMapKey`, the listener-id /
    composite-key bookkeeping) is deleted; the active-cohort registry
    collapses subscription state to one Map keyed by listener identity.

  ### Coverage

  - `packages/assessment-toolkit/tests/pie-512-phase-d-active-cohort-tracking.test.ts`
    (new) — 12 coordinator-only synthetic-harness tests covering active-cohort
    binding, migration with replay, replay ordering, the no-active-cohort
    throw, listener throw isolation, snapshot-safe unsubscribe during
    fan-out, same-cohort `updateInput` no-op, re-entrant subscribe during
    migration replay, and contract tolerance of prior `sectionId` args.
  - `packages/assessment-toolkit/tests/runtime/adapter/coordinator-bridge-cohort-handoff.test.ts`
    (new) — bridge + real-`ToolkitCoordinator` integration test mirroring
    Darin's persistent-host wrapper pattern: `resolveSectionController(A) →
resolveSectionController(B)` migrates a coordinator-bound listener with
    replay, `bridge.dispose()` detaches, and stale token rollovers do not
    dispatch a duplicate `section-controller-resolved` core input.
  - `packages/assessment-toolkit/tests/pie-512-cross-section-event-delivery.test.ts`
    — pre-existing PIE-512 regression pins, with `sectionId` arg dropped to
    match the Phase D shape; the three tests still pin live delivery on
    cohort flips, A→B→A round-trips, and asymmetric multi-item replays.
  - `packages/assessment-toolkit/tests/toolkit-coordinator-section-events.test.ts`
    — cleanup pass: rewrote "replaces existing subscription" to pin
    listener-identity dedup, deleted "ambiguous without attempt id"
    (no longer reachable), dropped `sectionId` args from all subscribes.

  ### Pre-fix failure gate

  Before any production code changed, the new + edited tests were run against
  the pre-fix source: 10 of 17 targeted tests failed in the expected ways
  (ambiguous-section throws, missed migrations, no throw isolation, missing
  contract tolerance, missing bridge replay). The 7 that passed against
  pre-fix source pin orthogonal invariants (single-cohort replay ordering,
  dispose-detach, snapshot-safe iteration). All 27 pass against the Phase D
  implementation.

  ### Migration notes for type consumers

  If your code imports `SectionEventSubscriptionArgs`,
  `SectionItemEventSubscriptionArgs`, or `SectionScopedEventSubscriptionArgs`
  directly, drop the `sectionId?` / `attemptId?` properties from your call
  sites — the runtime ignores them. Hosts using local hand-rolled structural
  types (e.g. an Angular wrapper) need no changes at compile time and pick
  up the runtime fix automatically.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.35
  - @pie-players/pie-calculator-desmos@0.3.35
  - @pie-players/pie-context@0.3.35
  - @pie-players/pie-players-shared@0.3.35
  - @pie-players/pie-tts@0.3.35
  - @pie-players/tts-client-server@0.3.35

## 0.3.34

### Patch Changes

- af850c0: fix(PIE-512): preserve controller lifecycle on same-section updateInput and always replay registry into resolved controller (Phase C)

  Phase B (released as `0.3.33`) replayed the engine's `RuntimeRegistry` into the
  new cohort's controller when the cohort flip resolved to a fresh controller —
  fixing the persistent-shell case. It left two related gaps that surfaced as
  intermittent regressions in the consumer's narrow-viewport (passage-only)
  flow:

  - `SectionController.initialize` ran `resetLifecycleTracking()` unconditionally,
    so any `updateInput` (which `ToolkitCoordinator.resolveExistingSectionController`
    always invokes when the engine resolves the existing controller) wiped
    `trackedRenderables`, `loadedRenderableKeys`, and `sectionLoadingComplete`.
    A subscriber that attached between the wipe and the next live event saw
    empty `runtimeState.loadedRenderables` and missed `content-loaded` /
    `section-loading-complete` for shells that were already mounted and
    loaded.
  - `SectionRuntimeEngine.initialize` only re-fed the registry into the
    controller when the resolved controller was a NEW instance
    (`resolved !== previousController`). Same-cohort `updateInput` resolves
    to the existing controller, so replay was skipped and the wipe above
    was not undone.

  Phase C closes both gaps:

  - `SectionController.initialize` now only calls `resetLifecycleTracking()`
    when the section identifier actually changes between the previous
    input and the next. Same-section refreshes preserve lifecycle state.
  - `SectionController.handleContentRegistered` and `handleContentLoaded`
    short-circuit on already-tracked / already-loaded renderable keys —
    no duplicate `content-loaded` emit, no spurious re-evaluation of
    `section-loading-complete`, and the engine's replay stays safe to
    run on every `initialize` call.
  - `SectionRuntimeEngine.initialize` drops the
    `resolved !== previousController` gate and unconditionally re-feeds
    the registry into the resolved controller. Combined with the
    controller-side idempotence above, the replay is a true no-op when
    the controller already knows about the registered shells, and a
    recovery seeding when an `updateInput` cohort refresh has wiped
    state.

  Coverage:

  - `packages/section-player/tests/section-controller-pie-512-phase-c.test.ts` —
    five new Bun unit tests pinning the controller-side invariants
    (no wipe on same-section `updateInput`; idempotent register / load;
    late subscriber on same-section `updateInput` observes preserved
    `runtimeState`).
  - `packages/assessment-toolkit/tests/pie-512-persistent-shell-cohort-handoff.test.ts` —
    new same-controller engine integration test covering the
    drop-the-gate change.
  - The existing PIE-512 cross-section A → B → A Playwright spec
    continues to pass unchanged. End-to-end coverage of the
    same-cohort `updateInput` path is intentionally left to the
    engine integration test (under `@happy-dom`) which exercises
    the exact engine→controller seam where the bug lived; a
    Playwright spec that drives a second `engine.initialize`
    imperatively from `page.evaluate` (mirroring the real
    consumer's plain-HTML pattern) is a useful follow-up but is
    not required for this fix.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.34
  - @pie-players/pie-calculator-desmos@0.3.34
  - @pie-players/pie-context@0.3.34
  - @pie-players/pie-players-shared@0.3.34
  - @pie-players/pie-tts@0.3.34
  - @pie-players/tts-client-server@0.3.34

## 0.3.33

### Patch Changes

- 70612af: PIE-512 follow-up: fix persistent-shell cohort handoff in the section runtime
  engine.

  When a passage shell stays mounted across a cohort flip (same passage element
  diffed between sections in the passage-only narrow-viewport split layout), it
  does not re-fire `pie-register` / `pie-content-loaded`. The previous fix
  restored event delivery for the **freshly-mounted** shell case, but the
  engine's `initialize(...)` swap to a new `SectionController` left that
  controller's `loadedRenderables` snapshot empty for any persistent shell —
  late `content-loaded` subscribers on the new cohort therefore saw nothing.

  `SectionRuntimeEngine` now mirrors a "loaded" set alongside the existing
  `RuntimeRegistry`. On a controller swap, it replays both the registered shells
  and the still-loaded ones into the new controller in document order, so the
  new cohort's snapshot is correct without requiring shells to remount.
  Same-cohort `updateInput` resolves to the existing controller and short-
  circuits the replay (no double-bookkeeping).

  Covered by
  `packages/assessment-toolkit/tests/pie-512-persistent-shell-cohort-handoff.test.ts`,
  which pins the cohort handoff at the engine layer (the previous Playwright
  e2e used `{#key}` and force-remounted the CE host, masking this gap).

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.33
  - @pie-players/pie-calculator-desmos@0.3.33
  - @pie-players/pie-context@0.3.33
  - @pie-players/pie-players-shared@0.3.33
  - @pie-players/pie-tts@0.3.33
  - @pie-players/tts-client-server@0.3.33

## 0.3.32

### Patch Changes

- 0355143: Fix PIE-512: replay `content-loaded` events for late subscribers after
  cohort transitions.

  `ToolkitCoordinator.subscribeSectionEvents` already replays a single
  `section-loading-complete` event to subscribers that attach after a
  controller finishes loading, but had no equivalent for the per-renderable
  `content-loaded` events that fire earlier in the sequence. Consumers that
  attached their listeners after the section player had bootstrapped (e.g.
  wrapper hosts that subscribe in response to `pie-section-controller-ready`,
  or hosts navigating across asymmetric sections in a narrow split-pane
  layout where the controller is recreated per cohort) silently missed every
  `content-loaded` event for renderables that had already loaded.

  The coordinator now replays one synthesized `content-loaded` event per
  renderable reported as loaded by the controller's runtime state, in
  registration order, immediately before the existing
  `section-loading-complete` replay. The replay is strict: only renderables
  explicitly reported in `runtimeState.loadedRenderables` are replayed, so
  synthetic test harnesses and older controllers that don't populate the
  field stay on the existing single-replay path.

  `SectionControllerRuntimeState` gains an optional
  `loadedRenderables: ReadonlyArray<{ itemId; canonicalItemId; contentKind }>`
  field, populated by `SectionController.getRuntimeState` from
  `loadedRenderableKeys` ∩ `trackedRenderables` in registration order. The
  field is purely additive; existing consumers that ignore it are
  unaffected.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.32
  - @pie-players/pie-calculator-desmos@0.3.32
  - @pie-players/pie-context@0.3.32
  - @pie-players/pie-players-shared@0.3.32
  - @pie-players/pie-tts@0.3.32
  - @pie-players/tts-client-server@0.3.32

## 0.3.31

### Patch Changes

- 26dbea3: PIE-501: harden element loading during section-player section swaps.

  Pre-1.0 lockstep release: every package in the `fixed` block bumps
  together at release time per the project versioning policy. Per pre-1.0
  semver convention every release is a patch bump, even when behavior
  changes are breaking — the breaking changes inventory below is for
  host migration, not for the version bump level. PIE-501
  investigation traced sporadic post-section-swap render failures
  (`Preloaded strategy requires pre-registered elements; missing tags:
…`) to two coupled root causes — a non-truthful element-load promise
  contract, and the section-player rewriting embedded items' loading
  strategy and tracking readiness through cached state. Fixing those
  unblocked a broader architecture-review compat-removal sweep that had
  been gated on the same surfaces.

  This release ships both phases of the PIE-501 plan plus the
  compat-removal work that fell out of the same review. None of the
  removed surfaces are part of the `pie-item` client contract (the only
  allowed compatibility surface per
  `.cursor/rules/legacy-compatibility-boundaries.mdc`).

  ## What's new

  - **Deep `ElementLoader` primitive** (PIE-501 Phase A). A single loader
    primitive whose promise resolves only when every requested custom-
    element tag is actually registered, and rejects with a per-tag
    reason otherwise. Both IIFE and ESM are now adapters over this
    primitive. Replaces the previous parallel `IifeLoader` / `EsmLoader`
    classes in `@pie-players/pie-players-shared`. The deep primitive is
    the shipped contract; the strategy name (`iife` / `esm` / `preloaded`)
    selects an adapter rather than a parallel implementation.

  - **Strategy substitution removed** (PIE-501 Phase B). Embedded
    item-players inherit the host's chosen strategy verbatim. The
    section-player still pre-warms the aggregate element set for
    performance but no longer owns correctness through cached state;
    widget readiness is now a function of inputs. The
    `allowPreloadedFallbackLoad` escape hatch is gone.

  - **M5 — strict two-tier mirror rule.** Tier-1 layout-CE props mirror
    to `runtime.*` keys with documented precedence; the resolver enforces
    the mirror per-key.

  - **M6 — canonical stage vocabulary.** `pie-stage-change` (`composed`,
    `engine-ready`, `interactive`, `disposed`) and `pie-loading-complete`
    are the canonical readiness surface, with a toolkit-side stage
    tracker and `onStageChange` / `onLoadingComplete` props on the layout
    CEs.

  - **M7 — `SectionRuntimeEngine`.** A single FSM-driven runtime engine
    consolidates section-controller lifecycle, readiness derivation, and
    stage emissions previously scattered across multiple coordinators.

  - **M8 — tool policy engine.** Allow/block + PNP/profile enforcement become a
    first-class policy surface on `ToolkitCoordinator`
    (`onPolicyChange`, `decideToolPolicy`, `updateToolPlacement`,
    `setPnpEnforcement`, `registerPolicySource`), with narrow profile
    auto-detection mirrored through `runtime.tools.pnpEnforcement`.

  - **`FrameworkErrorBus` contract.** A single canonical
    `framework-error` source, single subscription via
    `onFrameworkError(model: FrameworkErrorModel)`, and the layout-CE
    host emits exactly one `framework-error` per error (the previous
    toolkit-bubble + engine-bridge dual-emit is collapsed — see Removed).

  - **Tabbed section-player layout.** New `<pie-section-player-tabbed>`
    CE alongside the existing splitpane and vertical layouts.

  ## Removed (breaking)

  - **Deprecated `AssessmentToolkitEvents` event-map and member event
    interfaces** (`AssessmentStartedEvent`, `AssessmentCompletedEvent`,
    `AssessmentPausedEvent`, `AssessmentResumedEvent`,
    `CanNavigateChangedEvent`, `InteractionEvent`, `InteractionType`,
    `ItemChangedEvent`, `ItemMetadata`, `LoadCompleteEvent`,
    `LocaleChangedEvent`, `LocaleLoadingCompleteEvent`,
    `LocaleLoadingErrorEvent`, `LocaleLoadingStartEvent`,
    `NavigationRequestEvent`, `PlayerErrorEvent`, `SessionChangedEvent`,
    `StateRestoredEvent`, `StateSavedEvent`, `SyncFailedEvent`,
    `ToolActivatedEvent`, `ToolDeactivatedEvent`,
    `ToolStateChangedEvent`). They were aspirational and never emitted
    from any production path. The canonical replacement surfaces
    (DOM `CustomEvent`s on `<pie-assessment-toolkit>`,
    `ToolkitCoordinator.subscribe*` helpers, and the M3
    framework-error contract) are unchanged.

  - **Deprecated Svelte-store-shaped `toolCoordinatorStore`** and the
    prior `ToolCoordinator` _interface_ (the z-index / visibility shape
    in `packages/assessment-toolkit/src/tools/types.ts`, with
    `registerTool` / `showTool` / `hideTool` / `toggleTool` /
    `bringToFront` / `updateToolElement` / `hideAllTools` /
    `getToolState` / `isToolVisible`). The canonical replacement is the
    class-based `ToolCoordinator` (typed by `ToolCoordinatorApi` in
    `packages/assessment-toolkit/src/services/interfaces.ts`)
    re-exported from `@pie-players/pie-assessment-toolkit` and
    instantiated by `ToolkitCoordinator` as `coordinator.toolCoordinator`.
    All instance methods carry over verbatim, plus a `subscribe()` for
    reactive consumption that replaces the deleted Svelte-store derived
    views. Independently, `ToolkitCoordinator`'s tool-policy surface
    (`onPolicyChange`, `decideToolPolicy`, `updateToolPlacement`,
    `setPnpEnforcement`, `registerPolicySource`) is the canonical entry
    point for the _tool policy_ concern (allow/block + PNP/profile enforcement)
    — that is a different concern than the floating-tool z-index API
    the deleted interface served.

  - **Top-level `createSectionController` prop on every section-player
    layout custom element** (`<pie-section-player-splitpane>`,
    `<pie-section-player-vertical>`, `<pie-section-player-tabbed>`,
    `<pie-section-player-kernel-host>`, `<pie-section-player-base>`)
    and the corresponding kernel pass-through. The factory is now
    exposed only via `runtime.createSectionController`, the canonical
    M5 entry point.

    Note: `<pie-assessment-toolkit>`'s `createSectionController` prop
    is **unchanged** — the toolkit accepts it directly as part of its
    composition surface.

  - **Top-level `isolation` prop on every section-player layout custom
    element** (`<pie-section-player-splitpane>`,
    `<pie-section-player-vertical>`, `<pie-section-player-tabbed>`,
    `<pie-section-player-kernel-host>`, `<pie-section-player-base>`)
    and the corresponding kernel pass-through. The isolation strategy
    is now read only from `runtime.isolation`; when omitted, the
    resolver falls back to the package default (`DEFAULT_ISOLATION`).

    Note: the toolkit's `<pie-assessment-toolkit>` keeps `isolation` as a
    JS-only object property (see the toolkit-side carve-out below), but
    the kebab-attribute (`isolation="…"` HTML form) was also removed in
    this sweep. Layout-CE hosts must use `runtime.isolation`; standalone
    toolkit hosts must assign `el.isolation = …` programmatically.

  - **Top-level `item-toolbar-tools` / `passage-toolbar-tools`
    attribute aliases (and their `itemToolbarTools` / `passageToolbarTools`
    prop forms) on every section-player layout custom element**
    (`<pie-section-player-splitpane>`, `<pie-section-player-vertical>`,
    `<pie-section-player-tabbed>`, `<pie-section-player-kernel-host>`),
    along with the matching one-time deprecation warnings and the
    `parseToolList(itemToolbarTools)` / `parseToolList(passageToolbarTools)`
    absorption inside `resolveToolsConfig`. Per-region tool placement is
    now configured directly on the canonical `tools` object as
    `tools.placement.item` / `tools.placement.passage` (or via
    `runtime.tools.placement.{item,passage}`).

    The kernel re-exposes the canonical placement arrays as
    comma-separated strings via slot props (`itemToolbarTools`,
    `passageToolbarTools`) so internal card / pane custom elements
    (`<pie-section-player-item-card>`, `<pie-section-player-passage-card>`,
    `<pie-section-player-items-pane>`,
    `<pie-section-player-passages-pane>`) keep their existing
    string-attribute contract unchanged.

  - **Deprecated readiness DOM-event aliases on every section-player
    layout custom element** — `readiness-change`, `interaction-ready`,
    and `ready` — along with the engine's `legacy-event-bridge` that
    emitted them, the corresponding `SectionEngineOutput` kinds
    (`readiness-change`, `interaction-ready`, `ready`), the engine
    state fields that gated them (`interactionReadyEmitted`,
    `readyEmitted`, `lastReadinessDetail`), the
    `pie-section-readiness-change` / `pie-section-interaction-ready` /
    `pie-section-ready` instrumentation mappings, and the
    `readinessChange` / `interactionReady` / `ready` entries on
    `SECTION_PLAYER_PUBLIC_EVENTS`. Hosts now consume the canonical
    M6 vocabulary directly:

    - `readiness-change` → `pie-stage-change` (the readiness payload
      is also reachable via the layout CE's `selectReadiness()` /
      `getSnapshot().readiness`).
    - `interaction-ready` → `pie-stage-change` filtered on
      `detail.stage === "interactive"`.
    - `ready` → `pie-loading-complete`.

  - **Deprecated `section-controller-ready` Svelte/DOM event** — the
    kernel-side `dispatch("section-controller-ready", ...)` call,
    the matching `on:section-controller-ready={…}` forwarders on every
    layout CE wrapper (`<pie-section-player-splitpane>`,
    `<pie-section-player-vertical>`, `<pie-section-player-tabbed>`,
    `<pie-section-player-kernel-host>`), the
    `sectionControllerReady` entry on `SECTION_PLAYER_PUBLIC_EVENTS`,
    the `SectionPlayerControllerReadyDetail` type export, and the
    `pie-section-controller-ready` instrumentation mapping in
    `SECTION_INSTRUMENTATION_EVENT_MAP`. The kernel still feeds the
    engine FSM's `section-controller-resolved` input on first
    resolution per cohort (canonical stage progression
    `booting-section → engine-ready`); only the kernel-level Svelte
    event and its DOM-forwarded layout-host emit are gone. The
    toolkit-internal `pie-toolkit-section-controller-ready`
    telemetry name is unchanged. Migration:

    - Pull a controller handle directly:
      `await el.waitForSectionController(timeoutMs)` or
      `el.getSectionController()` on the layout CE.
    - Or filter `pie-stage-change` for
      `detail.stage === "engine-ready"` and then call
      `el.getSectionController()`.

  - **`autoFocusFirstItem` boolean alias on
    `SectionPlayerFocusPolicy`** and the runtime translation logic that
    mapped it onto the canonical `autoFocus` enum (along with its
    one-time deprecation warning). Hosts now set `autoFocus` directly:

    ```ts
    // before
    el.policies = { focus: { autoFocusFirstItem: true } };
    // after
    el.policies = { focus: { autoFocus: "start-of-content" } };
    // (or `"none"` to disable)
    ```

    The two Playwright tests that pinned the deprecated alias contract
    (`section-player-navigation-contract.spec.ts`) are removed.

  - **Orphaned `runtime-event-guards.ts` re-export shim** in
    `@pie-players/pie-assessment-toolkit` (`@deprecated since M7`,
    `createRuntimeId` is the only re-export). Import from
    `@pie-players/pie-assessment-toolkit/runtime/internal` instead.

  - **`one-time warning utility` deprecation-warning utility** and its
    public re-export from `@pie-players/pie-assessment-toolkit`
    (`packages/assessment-toolkit/src/services/deprecation-warnings.ts`,
    along with the test-only `test reset helper` and the
    `one-time warning utility` test block in
    `tests/framework-error-bus.test.ts`). Every internal callsite
    was removed earlier in this sweep; no in-tree code depends on the
    utility. External consumers that imported it from the package
    root should inline a per-callsite `console.warn` (the utility
    was a thin once-per-label, dev-only `console.warn` wrapper).

  - **Toolkit `isolation` kebab-attribute surface on
    `<pie-assessment-toolkit>`.** The `isolation` prop is now a
    JS-only object property (`type: "Object", reflect: false`); the
    previously observed `isolation="…"` HTML attribute is no longer
    parsed. Hosts that set isolation declaratively must move to a
    property assignment (or set it via `runtime.isolation` on the
    enclosing layout CE):

    ```html
    <!-- before -->
    <pie-assessment-toolkit isolation="shadow"></pie-assessment-toolkit>
    ```

    ```ts
    // after
    el.isolation = "shadow";
    ```

  - **Removed `ToolkitCoordinatorHooks` error hooks**
    (`onError`, `onTTSError`, `onProviderError`) and their
    subscription/dispatch logic on `ToolkitCoordinator`, plus the
    internal helpers (`toCauseError`, `contextFromFrameworkErrorModel`,
    `providerIdFromSource`) that synthesized the prior
    `(error, context)` payload from the canonical
    `FrameworkErrorModel`. The single canonical hook is
    `onFrameworkError(model: FrameworkErrorModel)`, which already
    delivers every `framework-error` exactly once per error
    (filterable on `model.kind`). Migration:

    ```ts
    // before
    coordinator.setHooks({
      onError: (error, context) => log({ error, context }),
      onTTSError: (error) => bumpTtsErrorCount(),
      onProviderError: (error, context) => log(context.providerId, error),
    });

    // after
    coordinator.setHooks({
      onFrameworkError: (model) => {
        // model.kind: "tool-config" | "runtime-init" | "runtime-dispose"
        //           | "coordinator-init" | "provider-init" | "provider-register"
        //           | "tts-init" | "tool-state-load" | "tool-state-save"
        //           | "section-controller-init" | "section-controller-dispose"
        //           | "unknown"
        // model.severity, model.source, model.message, model.details,
        // model.recoverable, model.cause, …
        log(model);
        if (model.kind === "tts-init") bumpTtsErrorCount();
      },
    });
    ```

  - **`framework-error` dual-emit on the layout CE host.** Previously,
    while a `<pie-assessment-toolkit>` was nested inside a layout CE,
    the layout host received **two** `framework-error` DOM events per
    error (one engine-bridge emit on the layout host plus the bubbled
    toolkit emit). The dual-emit is collapsed to a single canonical
    emit: the kernel's `handleFrameworkError` listener at
    `<pie-section-player-base>` now calls `event.stopPropagation()`
    after re-feeding the engine, so the bubbled toolkit emit no
    longer reaches the layout CE host. Outside listeners on the layout
    host now see exactly one `framework-error` per error — the
    engine-bridge emit (target = layout host, non-bubbling,
    non-composed). Direct listeners attached to
    `<pie-assessment-toolkit>` itself are unaffected (the toolkit
    dispatch reaches them before the kernel listener runs). The
    `onFrameworkError` callback prop and the package-internal
    `FrameworkErrorBus` are unchanged — both were already single-fire.
    The single-emit contract is now pinned by
    `packages/section-player/tests/section-player-framework-error-dual-emit.test.ts`
    (the file name is preserved for git blame; the test now asserts
    the single canonical emit).

  - **`allowPreloadedFallbackLoad` escape hatch.** Removed alongside the
    PIE-501 Phase B strategy-substitution work. Hosts that relied on it
    to mask preload-misses should ensure their preload set is correct
    (the `ElementLoader` primitive now rejects deterministically with a
    per-tag reason if a requested tag never registers).

  - **Per-strategy loader classes** (`IifeLoader`, `EsmLoader` and their
    test fixtures) in `@pie-players/pie-players-shared`. Replaced by the
    deep `ElementLoader` primitive plus IIFE / ESM adapters. Hosts that
    imported the loader classes directly should switch to
    `ElementLoader`; hosts that only used the public
    `<pie-item-player>` / `<pie-section-player-*>` attribute surface
    need no change.

  ## Migration

  ```ts
  // before
  const el = document.createElement("pie-section-player-splitpane");
  el.createSectionController = () => new SectionController();
  el.isolation = "shadow";
  el.setAttribute("item-toolbar-tools", "calculator,answer-eliminator");
  el.setAttribute("passage-toolbar-tools", "line-reader");

  // after
  el.runtime = {
    createSectionController: () => new SectionController(),
    isolation: "shadow",
    tools: {
      placement: {
        item: ["calculator", "answer-eliminator"],
        passage: ["line-reader"],
      },
    },
  };
  ```

  Section-controller resolution (replaces `section-controller-ready`):

  ```ts
  // before
  el.addEventListener("section-controller-ready", (event) => {
    const { controller } = (event as CustomEvent).detail;
    // …
  });

  // after — pull-style (preferred for one-shot consumers)
  const controller = await(
    el as HTMLElement & {
      waitForSectionController?: (timeoutMs?: number) => Promise<unknown>;
    }
  ).waitForSectionController?.(5000);

  // after — event-driven
  el.addEventListener("pie-stage-change", (event) => {
    const { stage } = (event as CustomEvent).detail;
    if (stage !== "engine-ready") return;
    const controller = (
      el as HTMLElement & { getSectionController?: () => unknown }
    ).getSectionController?.();
    // …
  });
  ```

  `AssessmentToolkitEvents` consumers should subscribe to the canonical
  DOM events / coordinator helpers instead. The Svelte-store coordinator
  had no in-tree consumers; hosts that imported it should switch to the
  class-based `ToolCoordinator` reachable via
  `coordinator.toolCoordinator` on `ToolkitCoordinator` (same method
  shape — `registerTool`, `showTool`, `hideTool`, `toggleTool`,
  `bringToFront`, `updateToolElement`, `hideAllTools`, `getToolState`,
  `isToolVisible` — plus `subscribe(listener)` for reactive consumers
  that previously relied on the Svelte-store derived views).

  ```ts
  // before
  el.addEventListener("readiness-change", (event) => {
    // event.detail: EngineReadinessDetail
  });
  el.addEventListener("interaction-ready", () => {
    // gate "start test" UI
  });
  el.addEventListener("ready", () => {
    // all items loaded
  });

  // after
  import type { StageChangeDetail } from "@pie-players/pie-players-shared/pie";
  import type { EngineReadinessDetail } from "@pie-players/pie-assessment-toolkit/runtime/internal";

  el.addEventListener("pie-stage-change", (event) => {
    const { stage } = (event as CustomEvent<StageChangeDetail>).detail;
    // stage: "composed" | "engine-ready" | "interactive" | "disposed"
    if (stage === "interactive") {
      // gate "start test" UI
    }
  });
  el.addEventListener("pie-loading-complete", () => {
    // all items loaded (single-shot, cohort-scoped)
  });
  // Readiness payload (formerly the `readiness-change` detail) is also
  // reachable on demand:
  const readiness: EngineReadinessDetail | undefined = el.selectReadiness?.();
  ```

  Hosts that previously de-duplicated `framework-error` listeners on the
  layout CE host (because the same logical error arrived twice — once
  bubbled from the toolkit, once from the engine bridge) can drop that
  de-dup logic: the layout host now fires `framework-error` exactly once
  per error. The canonical `onFrameworkError` callback prop and the
  package-internal `FrameworkErrorBus` were already single-fire and need
  no migration.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [26dbea3]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.31
  - @pie-players/pie-calculator@0.3.31
  - @pie-players/pie-calculator-desmos@0.3.31
  - @pie-players/pie-context@0.3.31
  - @pie-players/pie-tts@0.3.31
  - @pie-players/tts-client-server@0.3.31

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0981bc3]
- Updated dependencies [698aa82]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.30
  - @pie-players/pie-calculator@0.3.30
  - @pie-players/pie-calculator-desmos@0.3.30
  - @pie-players/pie-context@0.3.30
  - @pie-players/pie-tts@0.3.30
  - @pie-players/tts-client-server@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.29
  - @pie-players/pie-calculator-desmos@0.3.29
  - @pie-players/pie-context@0.3.29
  - @pie-players/pie-players-shared@0.3.29
  - @pie-players/pie-tts@0.3.29
  - @pie-players/tts-client-server@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.28
  - @pie-players/pie-calculator-desmos@0.3.28
  - @pie-players/pie-context@0.3.28
  - @pie-players/pie-players-shared@0.3.28
  - @pie-players/pie-tts@0.3.28
  - @pie-players/tts-client-server@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.27
  - @pie-players/pie-calculator-desmos@0.3.27
  - @pie-players/pie-context@0.3.27
  - @pie-players/pie-players-shared@0.3.27
  - @pie-players/pie-tts@0.3.27
  - @pie-players/tts-client-server@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.26
  - @pie-players/pie-calculator-desmos@0.3.26
  - @pie-players/pie-context@0.3.26
  - @pie-players/pie-players-shared@0.3.26
  - @pie-players/pie-tts@0.3.26
  - @pie-players/tts-client-server@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.25
  - @pie-players/pie-calculator-desmos@0.3.25
  - @pie-players/pie-context@0.3.25
  - @pie-players/pie-players-shared@0.3.25
  - @pie-players/pie-tts@0.3.25
  - @pie-players/tts-client-server@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.25
  - @pie-players/pie-calculator-desmos@0.3.25
  - @pie-players/pie-context@0.3.25
  - @pie-players/pie-players-shared@0.3.25
  - @pie-players/pie-tts@0.3.25
  - @pie-players/tts-client-server@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.24
  - @pie-players/pie-calculator-desmos@0.3.24
  - @pie-players/pie-context@0.3.24
  - @pie-players/pie-players-shared@0.3.24
  - @pie-players/pie-tts@0.3.24
  - @pie-players/tts-client-server@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.23
  - @pie-players/pie-calculator-desmos@0.3.23
  - @pie-players/pie-context@0.3.23
  - @pie-players/pie-players-shared@0.3.23
  - @pie-players/pie-tts@0.3.23
  - @pie-players/tts-client-server@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.22
  - @pie-players/pie-calculator-desmos@0.3.22
  - @pie-players/pie-context@0.3.22
  - @pie-players/pie-players-shared@0.3.22
  - @pie-players/pie-tts@0.3.22
  - @pie-players/tts-client-server@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.21
  - @pie-players/pie-calculator-desmos@0.3.21
  - @pie-players/pie-context@0.3.21
  - @pie-players/pie-players-shared@0.3.21
  - @pie-players/pie-tts@0.3.21
  - @pie-players/tts-client-server@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.20
  - @pie-players/pie-calculator-desmos@0.3.20
  - @pie-players/pie-context@0.3.20
  - @pie-players/pie-players-shared@0.3.20
  - @pie-players/pie-tts@0.3.20
  - @pie-players/tts-client-server@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.19
  - @pie-players/pie-calculator-desmos@0.3.19
  - @pie-players/pie-context@0.3.19
  - @pie-players/pie-players-shared@0.3.19
  - @pie-players/pie-tts@0.3.19
  - @pie-players/tts-client-server@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.18
  - @pie-players/pie-calculator-desmos@0.3.18
  - @pie-players/pie-context@0.3.18
  - @pie-players/pie-players-shared@0.3.18
  - @pie-players/pie-tts@0.3.18
  - @pie-players/tts-client-server@0.3.18

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.17
  - @pie-players/pie-calculator-desmos@0.3.17
  - @pie-players/pie-context@0.3.17
  - @pie-players/pie-players-shared@0.3.17
  - @pie-players/pie-tts@0.3.17
  - @pie-players/tts-client-server@0.3.17

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.16
  - @pie-players/pie-calculator-desmos@0.3.16
  - @pie-players/pie-context@0.3.16
  - @pie-players/pie-players-shared@0.3.16
  - @pie-players/pie-tts@0.3.16
  - @pie-players/tts-client-server@0.3.16

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.15
  - @pie-players/pie-calculator-desmos@0.3.15
  - @pie-players/pie-context@0.3.15
  - @pie-players/pie-players-shared@0.3.15
  - @pie-players/pie-tts@0.3.15
  - @pie-players/tts-client-server@0.3.15

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.14
  - @pie-players/pie-calculator-desmos@0.3.14
  - @pie-players/pie-context@0.3.14
  - @pie-players/pie-players-shared@0.3.14
  - @pie-players/pie-tts@0.3.14
  - @pie-players/tts-client-server@0.3.14

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.13
  - @pie-players/pie-calculator-desmos@0.3.13
  - @pie-players/pie-context@0.3.13
  - @pie-players/pie-players-shared@0.3.13
  - @pie-players/pie-tts@0.3.13
  - @pie-players/tts-client-server@0.3.13

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.12
  - @pie-players/pie-calculator-desmos@0.3.12
  - @pie-players/pie-context@0.3.12
  - @pie-players/pie-players-shared@0.3.12
  - @pie-players/pie-tts@0.3.12
  - @pie-players/tts-client-server@0.3.12

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.11
  - @pie-players/pie-calculator-desmos@0.3.11
  - @pie-players/pie-context@0.3.11
  - @pie-players/pie-players-shared@0.3.11
  - @pie-players/pie-tts@0.3.11
  - @pie-players/tts-client-server@0.3.11

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.10
  - @pie-players/pie-calculator-desmos@0.3.10
  - @pie-players/pie-context@0.3.10
  - @pie-players/pie-players-shared@0.3.10
  - @pie-players/pie-tts@0.3.10
  - @pie-players/tts-client-server@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.9
  - @pie-players/pie-calculator-desmos@0.3.9
  - @pie-players/pie-context@0.3.9
  - @pie-players/pie-players-shared@0.3.9
  - @pie-players/pie-tts@0.3.9
  - @pie-players/tts-client-server@0.3.9

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.10
  - @pie-players/pie-calculator-desmos@0.3.10
  - @pie-players/pie-context@0.3.10
  - @pie-players/pie-players-shared@0.3.10
  - @pie-players/pie-tts@0.3.10
  - @pie-players/tts-client-server@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.9
  - @pie-players/pie-calculator-desmos@0.3.9
  - @pie-players/pie-context@0.3.9
  - @pie-players/pie-players-shared@0.3.9
  - @pie-players/pie-tool-calculator-desmos@0.3.9
  - @pie-players/pie-tool-text-to-speech@0.3.9
  - @pie-players/pie-tool-tts-inline@0.3.9
  - @pie-players/pie-tts@0.3.9
  - @pie-players/tts-client-server@0.3.9

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.8
  - @pie-players/pie-calculator-desmos@0.3.8
  - @pie-players/pie-context@0.3.8
  - @pie-players/pie-players-shared@0.3.8
  - @pie-players/pie-tts@0.3.8
  - @pie-players/tts-client-server@0.3.8

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.7
  - @pie-players/pie-calculator-desmos@0.3.7
  - @pie-players/pie-context@0.3.7
  - @pie-players/pie-players-shared@0.3.7
  - @pie-players/pie-tts@0.3.7
  - @pie-players/tts-client-server@0.3.7

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.6
  - @pie-players/pie-calculator-desmos@0.3.6
  - @pie-players/pie-context@0.3.6
  - @pie-players/pie-players-shared@0.3.6
  - @pie-players/pie-tts@0.3.6
  - @pie-players/tts-client-server@0.3.6

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.5
  - @pie-players/pie-calculator-desmos@0.3.5
  - @pie-players/pie-context@0.3.5
  - @pie-players/pie-players-shared@0.3.5
  - @pie-players/pie-tts@0.3.5
  - @pie-players/tts-client-server@0.3.5

## 0.3.4

### Patch Changes

- Patch release for the lockstep package train with toolkit architecture hardening, stricter runtime validation, and a section-player vertical layout regression fix covered by e2e.
  - @pie-players/pie-calculator@0.3.4
  - @pie-players/pie-calculator-desmos@0.3.4
  - @pie-players/pie-context@0.3.4
  - @pie-players/pie-players-shared@0.3.4
  - @pie-players/pie-tts@0.3.4
  - @pie-players/tts-client-server@0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.3
  - @pie-players/pie-calculator-desmos@0.3.3
  - @pie-players/pie-context@0.3.3
  - @pie-players/pie-players-shared@0.3.3
  - @pie-players/pie-tts@0.3.3
  - @pie-players/tts-client-server@0.3.3

## 0.3.2

### Patch Changes

- Finalize the opt-in tool-loading model and align section demo/tooling behavior with explicit tool registration, section-level placement changes, and stronger interaction coverage in section-player tests.
  - @pie-players/pie-calculator@0.3.2
  - @pie-players/pie-calculator-desmos@0.3.2
  - @pie-players/pie-context@0.3.2
  - @pie-players/pie-players-shared@0.3.2
  - @pie-players/pie-tts@0.3.2
  - @pie-players/tts-client-server@0.3.2

## 0.3.1

### Patch Changes

- Patch release preparation for the fixed-version package group.
  - @pie-players/pie-calculator@0.3.1
  - @pie-players/pie-calculator-desmos@0.3.1
  - @pie-players/pie-context@0.3.1
  - @pie-players/pie-players-shared@0.3.1
  - @pie-players/pie-tts@0.3.1
  - @pie-players/tts-client-server@0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

- Updated dependencies
- Updated dependencies [9385ce0]
  - @pie-players/pie-calculator@0.3.0
  - @pie-players/pie-calculator-desmos@0.3.0
  - @pie-players/pie-context@0.3.0
  - @pie-players/pie-players-shared@0.3.0
  - @pie-players/pie-tts@0.3.0
  - @pie-players/tts-client-server@0.3.0

## 0.2.10

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/pie-calculator@0.1.5
  - @pie-players/pie-calculator-desmos@0.1.6
  - @pie-players/pie-context@0.1.2
  - @pie-players/pie-players-shared@0.2.6
  - @pie-players/pie-tts@0.1.5
  - @pie-players/tts-client-server@0.2.5

## 0.2.9

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
- Updated dependencies [71a9581]
  - @pie-players/pie-calculator@0.1.4
  - @pie-players/pie-calculator-desmos@0.1.5
  - @pie-players/pie-context@0.1.1
  - @pie-players/pie-players-shared@0.2.5
  - @pie-players/pie-tts@0.1.4
  - @pie-players/tts-client-server@0.2.4
