# PIE-727 Theming WCAG Matrix

Status: Draft

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
- Manual review is allowed only when the row explains why automation cannot prove
  the requirement.
- Playwright-backed checks must run outside the Cursor sandbox.

## Theme And Scheme Set

The default matrix set is:

- `light`
- `dark`
- `black-on-white`
- `white-on-black`
- one representative DaisyUI theme that is visually distinct from the PIE light
  and dark defaults

Implementation slices may add more schemes when a changed surface depends on a
specific palette or bridge behavior.

## Initial Matrix

| Surface | Owner | DOM Mode | States | Theme/Scheme Set | WCAG Criteria | Coverage Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Section tabs | `@pie-players/pie-section-player` | Light DOM | `default`, `hover`, `focus-visible`, `active`, `selected`, `disabled` | Default matrix set plus host-overridden tab tokens | 1.4.1, 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | `packages/section-player/tests/section-player-theme-token-docs.test.ts` covers docs/code token contract; add computed-style assertions to `packages/section-player/tests/section-theme-color-scheme.spec.ts` before visual token changes | Partial |
| Split divider | `@pie-players/pie-section-player` | Light DOM | `default`, `hover`, `focus-visible`, `dragging` | Default matrix set plus `--pie-section-player-focus-outline` override | 1.4.11, 2.4.7, 2.4.11, 2.4.13 | Extend `packages/section-player/tests/section-toolbar-tools.spec.ts` computed-style focus coverage | Planned |
| Section item scroll fade | `@pie-players/pie-section-player` | Light DOM | `default`, `overflowing`, `not-overflowing` | `light`, `dark`, `white-on-black`, representative DaisyUI theme | 1.4.1, 1.4.11 | Add computed-style/background assertion in a section-player Playwright spec; manual visual review only if gradient geometry cannot be asserted reliably | Planned |
| Assessment navigation | `@pie-players/pie-assessment-player` | Custom element surface | `default`, `hover`, `focus-visible`, `active`, `disabled` | Default matrix set plus host-overridden nav/background tokens | 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | `packages/assessment-player/tests/assessment-player-theme-contract.test.ts` covers `--pie-background-light` fallback; extend `packages/assessment-player/tests/assessment-player-smoke.spec.ts` with computed-style and axe coverage before visual nav changes | Partial |
| Item toolbar buttons | `@pie-players/pie-assessment-toolkit` | Shadow DOM through toolbar custom elements | `default`, `hover`, `focus-visible`, `active`, `selected`, `disabled`, `open` | Default matrix set plus host-overridden `--pie-button-*` and toolbar tokens | 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | Add package-level structural tests for token usage and browser coverage through section-player toolbar specs when rendered chrome is required | Planned |
| TTS inline trigger | `@pie-players/pie-tool-tts-inline` | Shadow DOM | `default`, `hover`, `focus-visible`, `active`, `open`, `disabled` | Default matrix set plus `--pie-tool-trigger-active-*` overrides | 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | `packages/tool-tts-inline/tests/tool-tts-inline-style-contract.test.ts` covers active trigger hooks and legacy button alias fallbacks; add browser computed-style coverage if visual behavior changes beyond structural contract | Partial |
| Calculator inline trigger | `@pie-players/pie-tool-calculator-inline-desmos` | Shadow DOM | `default`, `hover`, `focus-visible`, `active`, `open`, `disabled` | Default matrix set plus `--pie-tool-trigger-active-*` overrides | 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | Existing `packages/tool-calculator-inline-desmos/tests/tool-calculator-inline-style-contract.test.ts`; add browser computed-style coverage if visual behavior changes beyond structural contract | Partial |
| TTS inline speed controls | `@pie-players/pie-tool-tts-inline` | Shadow DOM | `default`, `hover`, `focus-visible`, `active`, `disabled` | Default matrix set plus host-overridden button and future control-active tokens | 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | Extend package style-contract tests before changing control-active theming; add Playwright only if computed behavior cannot be proven structurally | Planned |
| Floating graph/ruler/periodic table controls | Tool packages | Shadow DOM | `default`, `hover`, `focus-visible`, `active`, `selected`, `disabled` | Default matrix set plus component-scoped control-active tokens introduced by each slice | 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | Add package-local style-contract tests per package group; add browser coverage only for rendered state/contrast risks | Planned |
| Theme selector tool | `@pie-players/pie-tool-theme` | Shadow DOM | `default`, `hover`, `focus-visible`, `selected`, `open`, `disabled` | Default matrix set plus every built-in color scheme preview | 1.4.1, 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, 2.5.8 | Extend theme/tool-color-scheme tests when scheme fallback or preview behavior changes | Planned |

## Required Commands

Run these unit and contract checks as the base gate:

```sh
bun test packages/theme/src/theme-element.test.ts
bun test packages/theme-daisyui/tests/mapping-parity.test.mjs
bun run check:theme-tokens
bun test packages/theme/tests/token-registry-contract.test.ts
bun test packages/assessment-player/tests/assessment-player-theme-contract.test.ts
bun test packages/assessment-toolkit/tests/highlight-coordinator-tts-style.test.ts
bun test packages/section-player/tests/section-player-theme-token-docs.test.ts
bun test packages/tool-tts-inline/tests/tool-tts-inline-style-contract.test.ts
```

For section-player chrome changes, run Playwright outside the sandbox:

```sh
export SECTION_DEMOS_PORT=$(bun ./scripts/get-free-port.mjs 5300)
bun run build:e2e:section-player
bunx playwright test packages/section-player/tests/section-theme-color-scheme.spec.ts packages/section-player/tests/section-toolbar-tools.spec.ts --config packages/section-player/playwright.config.ts
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
- New public CSS variables are listed in `packages/theme/src/token-registry.json`
  and documented by the owning package.
