# Theming WCAG Matrix

Status: Active. Rows below carry the current coverage state; `Covered` means the
named check asserts every state in the row.

Owner: PIE Players maintainers

Related:

- [Broad theming contract](../prds/pie-727-broad-theming-contract.md)
- [Theme token inventory](./pie-727-theme-token-inventory.md)

## Purpose

This matrix records WCAG 2.2 AA coverage for every themed surface, for
contributors changing theme tokens, palettes or the chrome that reads them. It
is a blocking gate: a change to a visible themed surface adds or updates that
surface's row before the change is complete.

Rows are intentionally explicit about DOM mode, interactive state, theme/scheme
coverage, WCAG criteria, and verification owner. Automated computed-style checks
are preferred over screenshots. Axe checks are supporting evidence and do not by
themselves prove contrast or focus appearance.

## Coverage Rules

- Text contrast must be at least `4.5:1` for ordinary text.
- UI component, graphic, and focus indication contrast must be at least `3:1`.
- Focus-visible states must be keyboard reachable, visible, and not obscured.
- Target size checks apply to interactive controls where WCAG 2.5.8 is in scope.
- Forced-colors checks must preserve browser participation. Do not use
  `forced-color-adjust: none` to make authored palettes win over the user's
  system colors.
- Manual review is allowed only when the row explains why automation cannot prove
  the requirement.

## Theme And Scheme Set

The default matrix set is:

- `light`
- `dark`
- `black-on-white`
- `white-on-black`
- one representative DaisyUI theme that is visually distinct from the PIE light
  and dark defaults
- forced-colors mode for theme-managed controls and focus indicators

The canonical palette suite additionally validates every built-in scheme. Each
contrast assertion names its semantic foreground/background relationship and
threshold rather than inferring a relationship from token names.

## Matrix

| Surface | Owner | DOM mode | Status |
| --- | --- | --- | --- |
| [Section tabs](#section-tabs) | `@pie-players/pie-section-player` | Light DOM | Partial |
| [Split divider](#split-divider) | `@pie-players/pie-section-player` | Light DOM | Planned |
| [Section item scroll fade](#section-item-scroll-fade) | `@pie-players/pie-section-player` | Light DOM | Planned |
| [Section scrollbar chrome](#section-scrollbar-chrome) | `@pie-players/pie-section-player` | Light DOM | Partial |
| [Player error banners](#player-error-banners) | `@pie-players/pie-item-player`, `@pie-players/pie-players-shared` | Light DOM and custom element surface | Covered |
| [Debug and inspection panels](#debug-and-inspection-panels) | `@pie-players/pie-section-player-tools-*`, `@pie-players/pie-item-player` | Shadow DOM and light DOM panels | Partial |
| [Shared authored-content stylesheet](#shared-authored-content-stylesheet) | `@pie-players/pie-theme` | Host document (`components.css`) | Covered |
| [UA-painted chrome under a scheme](#ua-painted-chrome-under-a-scheme) | `@pie-players/pie-theme` | Host document and `<pie-theme>` scope | Partial |
| [Assessment navigation](#assessment-navigation) | `@pie-players/pie-assessment-player` | Custom element surface | Partial |
| [Item toolbar buttons](#item-toolbar-buttons) | `@pie-players/pie-assessment-toolkit` | Shadow DOM through toolbar custom elements | Partial |
| [TTS inline trigger](#tts-inline-trigger) | `@pie-players/pie-tool-tts-inline` | Shadow DOM | Partial |
| [Calculator inline trigger](#calculator-inline-trigger) | `@pie-players/pie-tool-calculator-inline-desmos` | Shadow DOM | Partial |
| [TTS inline speed controls](#tts-inline-speed-controls) | `@pie-players/pie-tool-tts-inline` | Shadow DOM | Planned |
| [Floating graph, ruler and periodic table controls](#floating-graph-ruler-and-periodic-table-controls) | Tool packages | Shadow DOM | Partial |
| [Canonical built-in palettes](#canonical-built-in-palettes) | `@pie-players/pie-theme` | Runtime and generated light-DOM CSS adapter | Covered |
| [Requested unavailable scheme](#requested-unavailable-scheme) | `@pie-players/pie-theme` | `<pie-theme>` self or document scope | Covered |
| [Color-scheme tool (`theme`)](#color-scheme-tool-theme) | `@pie-players/pie-tool-theme` | Shadow DOM | Partial |

## Surfaces

### Section tabs

- **States:** `default`, `hover`, `focus-visible`, `active`, `selected`, `disabled`
- **Theme/scheme set:** default matrix set plus host-overridden tab tokens
- **WCAG criteria:** 1.4.1, 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8
- **Coverage:** `packages/section-player/tests/section-player-theme-token-docs.test.ts`
  covers the docs/code token contract;
  `packages/section-player/tests/section-theme-color-scheme.spec.ts` asserts
  selected and unselected toggle legibility across every built-in scheme. Hover,
  disabled, focus-visible and a host override are not asserted.

### Split divider

- **States:** `default`, `hover`, `focus-visible`, `dragging`
- **Theme/scheme set:** default matrix set plus `--pie-section-player-focus-outline` override
- **WCAG criteria:** 1.4.11, 2.4.7, 2.4.11, 2.4.13
- **Coverage:** extend the computed-style focus coverage in
  `packages/section-player/tests/section-toolbar-tools.spec.ts`.

### Section item scroll fade

- **States:** `default`, `overflowing`, `not-overflowing`
- **Theme/scheme set:** `light`, `dark`, `white-on-black`, representative DaisyUI theme
- **WCAG criteria:** 1.4.1, 1.4.11
- **Coverage:** the gradient's solid end resolves through `--pie-white`, which
  every built-in sets to its page color. Add a computed-style or background
  assertion in a section-player Playwright spec; manual visual review only if
  gradient geometry cannot be asserted reliably.

### Section scrollbar chrome

- **States:** `default`, `hover`
- **Theme/scheme set:** default matrix set
- **WCAG criteria:** 1.4.11
- **Coverage:** `packages/section-player/tests/section-player-scrollbar-tokens.test.ts`
  pins each `--pie-scrollbar-*` hook to a canonical fallback chain;
  `packages/section-player/tests/section-player-scrollbar-visibility.spec.ts`
  covers rendered presence. The hooks are package-private, so the fallback is the
  contract.

### Player error banners

- **States:** `runtime error`, `authoring blocked`
- **Theme/scheme set:** every Base Theme at `--pie-fixed-hue-collapse: 0%` and every scheme at `100%`
- **WCAG criteria:** 1.4.1, 1.4.3, 1.4.11
- **Coverage:** `packages/players-shared/tests/error-banner-theming.test.ts` pins
  the collapse chain; `packages/item-player/tests/item-player-error-banner-scheme.spec.ts`
  measures fill, ink and edge under schemes.

### Debug and inspection panels

- **States:** `default`, `hover`, `focus-visible`, `resizing`, `collapsed`
- **Theme/scheme set:** default matrix set
- **WCAG criteria:** 1.4.1, 1.4.3, 1.4.11, 2.4.7
- **Coverage:** `packages/section-player-tools-shared/tests/panel-theming.test.ts`
  and `packages/section-player/tests/section-debug-panels-scheme.spec.ts`.

### Shared authored-content stylesheet

- **States:** `default` table, grid, scrim and emphasis classes
- **Theme/scheme set:** default matrix set plus `dracula` as the divergent-provider case
- **WCAG criteria:** 1.4.1, 1.4.3, 1.4.11
- **Coverage:** `packages/theme/tests/content-styles-theming.test.ts`;
  `scripts/tests/check-theme-tokens.test.mjs` guards the pruned rule set.

### UA-painted chrome under a scheme

- **States:** scrollbars, form widgets, spellcheck underlines
- **Theme/scheme set:** polarity derived per palette from contrast against the
  resolved `--pie-background`; `null` when the background is not opaque, leaving
  polarity to the host
- **WCAG criteria:** 1.4.1, 1.4.3
- **Coverage:** `packages/theme/tests/theme-resolution.test.ts` asserts derived
  polarity for representative built-ins and the `null` base-theme case;
  `packages/theme/tests/theme-element-dom.test.ts` asserts the element stamps and
  restores it. Browser participation is not overridden.

### Assessment navigation

- **States:** `default`, `hover`, `focus-visible`, `active`, `disabled`
- **Theme/scheme set:** default matrix set plus host-overridden nav and background tokens
- **WCAG criteria:** 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8
- **Coverage:** `packages/assessment-player/tests/assessment-player-theme-contract.test.ts`
  covers the `--pie-background` read; extend
  `packages/assessment-player/tests/assessment-player-smoke.spec.ts` with
  computed-style and axe coverage before visual nav changes.

### Item toolbar buttons

- **States:** `default`, `hover`, `focus-visible`, `active`, `selected`, `disabled`, `open`
- **Theme/scheme set:** default matrix set plus host-overridden `--pie-button-*` and toolbar tokens
- **WCAG criteria:** 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8
- **Coverage:** `packages/assessment-toolkit/tests/toolbar-items.test.ts` covers
  token usage for chrome and glyphs. Browser coverage through the section-player
  toolbar specs is still needed for rendered contrast and target size.

### TTS inline trigger

- **States:** `default`, `hover`, `focus-visible`, `active`, `open`, `disabled`
- **Theme/scheme set:** default matrix set plus `--pie-tool-trigger-active-*` overrides
- **WCAG criteria:** 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8
- **Coverage:** `packages/tool-tts-inline/tests/tool-tts-inline-style-contract.test.ts`
  covers the active trigger hooks and the legacy button alias fallbacks. Add
  browser computed-style coverage if visual behavior changes beyond the
  structural contract.

### Calculator inline trigger

- **States:** `default`, `hover`, `focus-visible`, `active`, `open`, `disabled`
- **Theme/scheme set:** default matrix set plus `--pie-tool-trigger-active-*` and `--pie-button-*` overrides
- **WCAG criteria:** 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8
- **Coverage:** `packages/tool-calculator-inline-desmos/tests/tool-calculator-inline-style-contract.test.ts`
  covers the active trigger hooks, pins the `default` and `hover` fills to the
  button-token chains, and asserts no fill resolves through `--pie-background`,
  the page token a host may point at its own backdrop. Rest ink is `--pie-text`
  and the boundary `--pie-border` over a `--pie-button-bg` fill; that pairing is
  not a declared contrast relationship and holds only because every scheme
  collapses the two families onto one color. Add browser computed-style coverage
  if visual behavior changes beyond the structural contract.

### TTS inline speed controls

- **States:** `default`, `hover`, `focus-visible`, `active`, `disabled`
- **Theme/scheme set:** default matrix set plus host-overridden button and future control-active tokens
- **WCAG criteria:** 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8
- **Coverage:** the `aria-checked` state emphasizes with `--pie-primary` and has
  no component-scoped hook. Extend the package style-contract tests before
  changing control-active theming; add Playwright only if computed behavior
  cannot be proven structurally.

### Floating graph, ruler and periodic table controls

- **States:** `default`, `hover`, `focus-visible`, `active`, `selected`, `disabled`
- **Theme/scheme set:** default matrix set plus any component-scoped control-active tokens a change introduces
- **WCAG criteria:** 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8
- **Coverage:** graph, ruler, protractor and line-reader sources paint only
  through `var(--pie-*)` chains, and the periodic table's category fills are
  fixed hues folded through `--pie-fixed-hue-collapse`.
  `packages/tool-periodic-table/tests/tool-periodic-table-style-contract.test.ts`
  covers its cells. Graph, ruler, protractor and line-reader have no
  style-contract test — `tool-graph.contract.test.ts` covers runtime context, not
  tokens — and no package has rendered-state coverage.

### Canonical built-in palettes

- **States:** `default`, every built-in, base/provider precedence
- **Theme/scheme set:** every built-in over light and dark base inputs
- **WCAG criteria:** 1.4.1, 1.4.3, 1.4.11, 2.4.7, 2.4.13
- **Coverage:** `packages/theme/tests/token-registry-contract.test.ts` and
  `theme-definition-contract.test.ts` assert complete participating token sets,
  opaque required contrast-role values, named 4.5:1 text and 3:1 UI/focus
  relationships, and generated/runtime parity.

### Requested unavailable scheme

- **States:** unavailable, late registration, removal, re-registration
- **Theme/scheme set:** light, dark, provider result, retained CSS selector hook
- **WCAG criteria:** 1.4.1, 1.4.3, 1.4.11
- **Coverage:** `packages/theme/tests/theme-resolution.test.ts` and
  `theme-element-dom.test.ts` assert the requested id survives while a safe
  palette renders and restores;
  `packages/section-player/tests/section-theme-color-scheme.spec.ts` asserts the
  normal cascade for stylesheet-only delivery, the `!important` boundary against
  mounted inline tokens, and a persisted unavailable scheme staying visible but
  unselectable.

### Color-scheme tool (`theme`)

The color-scheme tool is the learner-facing scheme picker, published as
`@pie-players/pie-tool-theme` from `packages/tool-color-scheme`.

- **States:** `default`, `hover`, `focus-visible`, `selected`, `open`, `disabled`, `unavailable`
- **Theme/scheme set:** default matrix set, every built-in derived preview, late custom registration, forced-colors
- **WCAG criteria:** 1.4.1, 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8, 4.1.3
- **Coverage:** `packages/tool-color-scheme/tests/built-theme-registry-integration.test.ts`
  asserts the built picker observes the theme-package registry;
  `section-theme-color-scheme.spec.ts` covers every built-in picker state at its
  named threshold, selected text through the DaisyUI provider, menu keyboard
  navigation with focus return on Escape, and forced-colors participation. Hover
  and disabled are not asserted.

## Required Commands

Run these unit and contract checks as the base gate:

```sh
bun test --dom packages/theme/tests
bun --cwd packages/theme run check:generated-css
bun run check:theme-tokens
bun test packages/theme/tests/token-registry-contract.test.ts
bun test packages/assessment-player/tests/assessment-player-theme-contract.test.ts
bun test packages/assessment-toolkit/tests/highlight-coordinator-tts-style.test.ts
bun test packages/section-player/tests/section-player-theme-token-docs.test.ts
bun test packages/section-player/tests/section-player-scrollbar-tokens.test.ts
bun test packages/section-player-tools-shared/tests/panel-theming.test.ts
bun test packages/players-shared/tests/error-banner-theming.test.ts
bun test packages/assessment-toolkit/tests/toolbar-items.test.ts
bun test packages/tool-tts-inline/tests/tool-tts-inline-style-contract.test.ts
bun test packages/tool-calculator-inline-desmos/tests/tool-calculator-inline-style-contract.test.ts
bun test packages/tool-periodic-table/tests/tool-periodic-table-style-contract.test.ts
bun test scripts/tests/check-theme-tokens.test.mjs
```

For section-player chrome changes, run Playwright:

```sh
export SECTION_DEMOS_PORT=$(bun ./scripts/get-free-port.mjs 5300)
bun run build:e2e:section-player
bunx playwright test packages/section-player/tests/section-theme-color-scheme.spec.ts packages/section-player/tests/section-toolbar-tools.spec.ts packages/section-player/tests/section-debug-panels-scheme.spec.ts packages/section-player/tests/section-player-scrollbar-visibility.spec.ts --config packages/section-player/playwright.config.ts
```

For item-player chrome changes, run Playwright:

```sh
export ITEM_DEMOS_PORT=$(bun ./scripts/get-free-port.mjs 5400)
bun run build:e2e:item-player
bunx playwright test packages/item-player/tests/item-player-error-banner-scheme.spec.ts --config packages/item-player/playwright.config.ts
```

For assessment-player chrome changes, run Playwright:

```sh
bun run build:e2e:assessment-player
bunx playwright test packages/assessment-player/tests/assessment-player-smoke.spec.ts --config packages/assessment-player/playwright.config.ts
```

## Exit Criteria

- Touched visible surfaces have rows in this matrix.
- The implementation PR states which rows changed from `Planned` to `Partial` or
  `Covered`.
- Each row has automated coverage or a manual-review rationale.
- Computed-style checks cover contrast and focus for changed states.
- Theme and picker browser checks include forced-colors and confirm there is no
  `forced-color-adjust: none` opt-out.
- New public theme tokens are listed in `packages/theme/src/token-registry.json`
  and documented by the owning package.
