# PIE-727 Theming WCAG Matrix

Status: Active. Rows below carry the current coverage state; `Covered` means the
named check asserts every state in the row.

Owner: PIE Players maintainers

Related:

- [PIE-727 Broad Theming Contract](../prds/pie-727-broad-theming-contract.md)
- [PIE-727 Theme Token Inventory](./pie-727-theme-token-inventory.md)
- [PIE-727 Theming Implementation Slices](./pie-727-theming-implementation-slices.md)

## Purpose

This matrix is the blocking accessibility artifact for broad PIE-727 theming
work. Every source-changing theming slice must add or update rows for the
visible surfaces it touches before implementation is considered complete.

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
- Playwright-backed checks must run outside a default agent tool sandbox.

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

| Surface | Owner | DOM Mode | States | Theme/Scheme Set | WCAG Criteria | Coverage Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Section tabs | `@pie-players/pie-section-player` | Light DOM | `default`, `hover`, `focus-visible`, `active`, `selected`, `disabled` | Default matrix set plus host-overridden tab tokens | 1.4.1, 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | `packages/section-player/tests/section-player-theme-token-docs.test.ts` covers the docs/code token contract; `packages/section-player/tests/section-theme-color-scheme.spec.ts` asserts selected and unselected toggle legibility across every built-in scheme. Hover, disabled, focus-visible and a host override are not asserted | Partial |
| Split divider | `@pie-players/pie-section-player` | Light DOM | `default`, `hover`, `focus-visible`, `dragging` | Default matrix set plus `--pie-section-player-focus-outline` override | 1.4.11, 2.4.7, 2.4.11, 2.4.13 | Extend `packages/section-player/tests/section-toolbar-tools.spec.ts` computed-style focus coverage | Planned |
| Section item scroll fade | `@pie-players/pie-section-player` | Light DOM | `default`, `overflowing`, `not-overflowing` | `light`, `dark`, `white-on-black`, representative DaisyUI theme | 1.4.1, 1.4.11 | Source tokenized in 2bcd9faf: the gradient's solid end resolves through `--pie-white`, which every built-in sets to its page colour. Add computed-style/background assertion in a section-player Playwright spec; manual visual review only if gradient geometry cannot be asserted reliably | Planned |
| Section scrollbar chrome | `@pie-players/pie-section-player` | Light DOM | `default`, `hover` | Default matrix set | 1.4.11 | `packages/section-player/tests/section-player-scrollbar-tokens.test.ts` pins each `--pie-scrollbar-*` hook to a canonical fallback chain; `packages/section-player/tests/section-player-scrollbar-visibility.spec.ts` covers rendered presence. Hooks are package-private, so the fallback is the contract | Partial |
| Player error banners | `@pie-players/pie-item-player`, `@pie-players/pie-players-shared` | Light DOM and custom element surface | `runtime error`, `authoring blocked` | Every Base Theme at `--pie-fixed-hue-collapse: 0%` and every scheme at `100%` | 1.4.1, 1.4.3, 1.4.11 | `packages/players-shared/tests/error-banner-theming.test.ts` pins the collapse chain; `packages/item-player/tests/item-player-error-banner-scheme.spec.ts` measures fill/ink and edge under schemes | Covered |
| Debug and inspection panels | `@pie-players/pie-section-player-tools-*`, `@pie-players/pie-item-player` | Shadow DOM and light DOM panels | `default`, `hover`, `focus-visible`, `resizing`, `collapsed` | Default matrix set | 1.4.1, 1.4.3, 1.4.11, 2.4.7 | `packages/section-player-tools-shared/tests/panel-theming.test.ts` and `packages/section-player/tests/section-debug-panels-scheme.spec.ts` | Partial |
| Shared authored-content stylesheet | `@pie-players/pie-theme` | Host document (`components.css`) | `default` table/grid/scrim/emphasis classes | Default matrix set plus `dracula` as the divergent-provider case | 1.4.1, 1.4.3, 1.4.11 | `packages/theme/tests/content-styles-theming.test.ts`; `scripts/tests/check-theme-tokens.test.mjs` guards the pruned rule set | Covered |
| UA-painted chrome under a scheme | `@pie-players/pie-theme` | Host document and `<pie-theme>` scope | scrollbars, form widgets, spellcheck underlines | Polarity derived per palette from contrast against the resolved `--pie-background`; `null` when the background is not opaque, leaving polarity to the host | 1.4.1, 1.4.3 | `packages/theme/tests/theme-resolution.test.ts` asserts derived polarity for representative built-ins and the `null` base-theme case; `packages/theme/tests/theme-element-dom.test.ts` asserts the element stamps and restores it. Browser participation is not overridden | Partial |
| Assessment navigation | `@pie-players/pie-assessment-player` | Custom element surface | `default`, `hover`, `focus-visible`, `active`, `disabled` | Default matrix set plus host-overridden nav/background tokens | 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | `packages/assessment-player/tests/assessment-player-theme-contract.test.ts` covers `--pie-background-light` fallback; extend `packages/assessment-player/tests/assessment-player-smoke.spec.ts` with computed-style and axe coverage before visual nav changes | Partial |
| Item toolbar buttons | `@pie-players/pie-assessment-toolkit` | Shadow DOM through toolbar custom elements | `default`, `hover`, `focus-visible`, `active`, `selected`, `disabled`, `open` | Default matrix set plus host-overridden `--pie-button-*` and toolbar tokens | 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | `packages/assessment-toolkit/tests/toolbar-items.test.ts` covers token usage for chrome and glyphs after 2bcd9faf and 2a741c6b; browser coverage through section-player toolbar specs is still needed for rendered contrast and target size | Partial |
| TTS inline trigger | `@pie-players/pie-tool-tts-inline` | Shadow DOM | `default`, `hover`, `focus-visible`, `active`, `open`, `disabled` | Default matrix set plus `--pie-tool-trigger-active-*` overrides | 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | `packages/tool-tts-inline/tests/tool-tts-inline-style-contract.test.ts` covers active trigger hooks and legacy button alias fallbacks; add browser computed-style coverage if visual behavior changes beyond structural contract | Partial |
| Calculator inline trigger | `@pie-players/pie-tool-calculator-inline-desmos` | Shadow DOM | `default`, `hover`, `focus-visible`, `active`, `open`, `disabled` | Default matrix set plus `--pie-tool-trigger-active-*` overrides | 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | Existing `packages/tool-calculator-inline-desmos/tests/tool-calculator-inline-style-contract.test.ts`; add browser computed-style coverage if visual behavior changes beyond structural contract | Partial |
| TTS inline speed controls | `@pie-players/pie-tool-tts-inline` | Shadow DOM | `default`, `hover`, `focus-visible`, `active`, `disabled` | Default matrix set plus host-overridden button and future control-active tokens | 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | The `aria-checked` state emphasises with `--pie-primary` and has no component-scoped hook. Extend package style-contract tests before changing control-active theming; add Playwright only if computed behavior cannot be proven structurally | Planned |
| Floating graph/ruler/periodic table controls | Tool packages | Shadow DOM | `default`, `hover`, `focus-visible`, `active`, `selected`, `disabled` | Default matrix set plus component-scoped control-active tokens introduced by each slice | 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | No colour literals remain outside `var(--pie-*)` chains in any `packages/tool-*` source as of 2026-08-15; `packages/tool-periodic-table/tests/tool-periodic-table-style-contract.test.ts` covers its cells after e8a6f0ec. Graph, ruler, protractor and line-reader have no style-contract test — `tool-graph.contract.test.ts` covers runtime context, not tokens — and no package has rendered-state coverage | Partial |
| Canonical built-in palettes | `@pie-players/pie-theme` | Runtime and generated light-DOM CSS adapter | `default`, every built-in, base/provider precedence | Every built-in over light and dark base inputs | 1.4.1, 1.4.3, 1.4.11, 2.4.7, 2.4.13 | `packages/theme/tests/token-registry-contract.test.ts` and `theme-definition-contract.test.ts` assert complete participating token sets, opaque required contrast-role values, named 4.5:1 text and 3:1 UI/focus relationships, and generated/runtime parity | Covered |
| Requested unavailable scheme | `@pie-players/pie-theme` | `<pie-theme>` self or document scope | unavailable, late registration, removal, re-registration | Light, dark, provider result, retained CSS selector hook | 1.4.1, 1.4.3, 1.4.11 | `packages/theme/tests/theme-resolution.test.ts` and `theme-element-dom.test.ts` assert the requested id survives while a safe palette renders and restores; `packages/section-player/tests/section-theme-color-scheme.spec.ts` asserts the normal cascade for stylesheet-only delivery, the `!important` boundary against mounted inline tokens, and a persisted unavailable scheme staying visible but unselectable | Covered |
| Theme selector tool | `@pie-players/pie-tool-theme` (source at `packages/tool-color-scheme`) | Shadow DOM | `default`, `hover`, `focus-visible`, `selected`, `open`, `disabled`, `unavailable` | Default matrix set, every built-in derived preview, late custom registration, forced-colors | 1.4.1, 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8, 4.1.3 | `packages/tool-color-scheme/tests/built-theme-registry-integration.test.ts` asserts the built picker observes the theme-package registry; `section-theme-color-scheme.spec.ts` covers every built-in picker state at its named threshold, selected text through the DaisyUI provider, menu keyboard navigation with focus return on Escape, and forced-colors participation. Hover and disabled are not asserted | Partial |

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

For section-player chrome changes, run Playwright outside the sandbox:

```sh
export SECTION_DEMOS_PORT=$(bun ./scripts/get-free-port.mjs 5300)
bun run build:e2e:section-player
bunx playwright test packages/section-player/tests/section-theme-color-scheme.spec.ts packages/section-player/tests/section-toolbar-tools.spec.ts packages/section-player/tests/section-debug-panels-scheme.spec.ts packages/section-player/tests/section-player-scrollbar-visibility.spec.ts --config packages/section-player/playwright.config.ts
```

For item-player chrome changes, run Playwright outside the sandbox:

```sh
export ITEM_DEMOS_PORT=$(bun ./scripts/get-free-port.mjs 5400)
bun run build:e2e:item-player
bunx playwright test packages/item-player/tests/item-player-error-banner-scheme.spec.ts --config packages/item-player/playwright.config.ts
```

For assessment-player chrome changes, run Playwright outside the sandbox:

```sh
bun run build:e2e:assessment-player
bunx playwright test packages/assessment-player/tests/assessment-player-smoke.spec.ts --config packages/assessment-player/playwright.config.ts
```

## Per-Slice Exit Criteria

- Touched visible surfaces have rows in this matrix.
- The implementation PR states which rows changed from `Planned` to `Partial` or
  covered.
- Each row has automated coverage or a manual-review rationale.
- Computed-style checks cover contrast and focus for changed states.
- Theme and picker browser checks include forced-colors and confirm there is no
  `forced-color-adjust: none` opt-out.
- New public CSS variables are listed in `packages/theme/src/token-registry.json`
  and documented by the owning package.
