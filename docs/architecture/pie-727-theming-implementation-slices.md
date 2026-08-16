# PIE-727 Theming Implementation Slices

Status: Active. The tables below are the per-surface record; the
[contract](../prds/pie-727-broad-theming-contract.md) is `Accepted` and does not
track slices.

Owner: PIE Players maintainers

Related:

- [PIE-727 Broad Theming Contract](../prds/pie-727-broad-theming-contract.md)
- [PIE-727 Theme Token Inventory](./pie-727-theme-token-inventory.md)
- [PIE-727 Theming WCAG Matrix](./pie-727-theming-wcag-matrix.md)

## Slice Rules

- Treat the consumer pad as the compatibility envelope: preserve observed Host
  A/V token, artifact, entrypoint, and explicit-light behavior, but do not add
  aliases or transitional implementations for unobserved legacy interfaces.
- Follow established repo patterns first: canonical semantic tokens,
  `--pie-button-*` chains, package-local README docs, package-local tests, and
  additive fallback behavior.
- Add component-scoped hooks only for real host integration points that cannot be
  safely served by existing semantic or button tokens.
- Map every touched visible surface to the WCAG matrix before changing source.
- Keep source-changing slices small enough to review independently.

## Landed

| Surface | Package | Change | Verification |
| --- | --- | --- | --- |
| Token registry and parity | `@pie-players/pie-theme` | Added registry entries for canonical defaults, inline trigger hooks, section tab hooks, legacy aliases, and decision-gate tokens. Added parity checks for `theme-definitions.ts`, generated CSS, Scheme Participation, and focus alias fallback. | `bun test packages/theme/tests/token-registry-contract.test.ts` |
| Theme shared focus wrappers | `@pie-players/pie-theme` | Routed `--pie-focus-ring-color` through `--pie-focus-outline` and `--pie-button-focus-outline`. | `bun test packages/theme/tests/token-registry-contract.test.ts` |
| Assessment navigation backgrounds | `@pie-players/pie-assessment-player` | Preserved `--pie-background-light` but added `--pie-background` fallback. | `bun test packages/assessment-player/tests/assessment-player-theme-contract.test.ts` |
| Section tabs docs/registry | `@pie-players/pie-section-player` | Documented actual tab CSS variables and registered them as component-public hooks. | `bun test packages/section-player/tests/section-player-theme-token-docs.test.ts` |
| TTS inline button aliases | `@pie-players/pie-tool-tts-inline` | Preserved `--pie-button-*-color` style aliases while routing through canonical `--pie-button-*` fallbacks. | `bun test packages/tool-tts-inline/tests/tool-tts-inline-style-contract.test.ts` |
| Canonical theme and colour schemes (1f29de7f, 2026-08-13) | `@pie-players/pie-theme`, `@pie-players/pie-tool-theme` | The coordinated slice below, as enumerated. | `bun run check:theme-tokens`; `bun test --dom packages/theme/tests` |
| Provider precedence and `color-scheme` stamping (5055facc, 5a137556) | `@pie-players/pie-theme` | Provider variables resolve from the theme being applied rather than the previous one; `color-scheme` is stamped from the resolved scheme, so UA-painted chrome follows the palette. | `packages/theme/tests/theme-element-dom.test.ts`; `packages/theme/tests/theme-resolution.test.ts` |
| Shared content stylesheet, NDS buttons, tool chrome (2bcd9faf, e8a6f0ec — PIE-908) | `@pie-players/pie-theme`, `@pie-players/pie-assessment-toolkit`, `@pie-players/pie-players-shared`, `@pie-players/pie-tool-periodic-table` | `components.css` authored-content classes, spinner, preview toggle, toolbar chrome and periodic-table cells resolve from the palette; `.content-emphasis` closed a 1.4.3 gap on the default page. | `packages/theme/tests/content-styles-theming.test.ts`; `packages/assessment-toolkit/tests/toolbar-items.test.ts`; `scripts/tests/check-theme-tokens.test.mjs` |
| Scrollbar chrome (2bcd9faf) | `@pie-players/pie-section-player` | The three panes' `--pie-scrollbar-*` hooks default through boundary and surface tokens instead of literals. Kept package-private: no theme or scheme sets them, so the fallback is the contract. | `packages/section-player/tests/section-player-scrollbar-tokens.test.ts` |
| Passage/questions toggle and pinned accents (eba2683d, 76003e23) | `@pie-players/pie-section-player`, `@pie-players/pie-tool-calculator-inline-desmos` | Tab pill and calculator trigger resolve to the palette under a scheme through `--pie-fixed-hue-collapse`. | `packages/section-player/tests/section-theme-color-scheme.spec.ts`; `packages/tool-calculator-inline-desmos/tests/tool-calculator-inline-style-contract.test.ts` |
| Inline TTS panel and calculator glyph (2a741c6b — PIE-907) | `@pie-players/pie-tool-tts-inline`, `@pie-players/pie-assessment-toolkit` | Panel chrome and toolbar glyph paint from the theme. | `packages/tool-tts-inline/tests/tool-tts-inline-style-contract.test.ts`; `packages/assessment-toolkit/tests/toolbar-items.test.ts` |
| Player error banners (55016b5d) | `@pie-players/pie-item-player`, `@pie-players/pie-players-shared` | Three banners go through `--pie-fixed-hue-collapse`: exact at every Base Theme, palette-resolved under every scheme. | `packages/item-player/tests/item-player-error-banner-scheme.spec.ts`; `packages/players-shared/tests/error-banner-theming.test.ts` |
| Debug and inspection panels (951c222c) | `@pie-players/pie-section-player-tools-*`, `@pie-players/pie-item-player` | Panel chrome, resize handles and window controls on the `--pie-*` contract. | `packages/section-player-tools-shared/tests/panel-theming.test.ts`; `packages/section-player/tests/section-debug-panels-scheme.spec.ts` |
| DaisyUI bridge package removed (9d3c5005) | — | The `pie-theme-daisyui` bridge package is deleted; the `daisyui` provider adapter in `packages/theme` is the only mapping, and the one that can correct an illegible slot from resolved colours. Recorded against the consumer pad. | `packages/theme/tests/daisyui-mapping.test.ts` |

## Coordinated Canonical Theme Slice

Landed as 1f29de7f (2026-08-13), as one source-changing slice because splitting
it would temporarily recreate the duplicate source of truth it removes.

1. Add the side-effect-free canonical TypeScript definition for light/dark base
   themes and ten complete, explicitly authored built-in palettes.
2. Add `required | optional | excluded` Scheme Participation metadata to the
   token registry and validate completeness plus named WCAG relationships.
3. Publish `resolvePieTheme`, `listPieColorSchemes`,
   `observePieColorSchemes`, and `registerPieColorSchemes`. Return immutable
   resolutions/snapshots and generation-aware registration receipts.
4. Make `<pie-theme>` and Theme Provider registration observe the same global
   catalog. Preserve requested-but-unavailable ids and automatically resolve
   after late scheme or provider registration.
5. Update `@pie-players/pie-tool-theme` to observe `snapshot.schemes`, derive
   previews from resolved values, and expose a disabled, announced unavailable
   preference instead of resetting it. Remove the unconsumed `schemes` and
   `schemeCatalog` inputs without a compatibility layer.
6. Generate checked-in `tokens.css` and `color-schemes.css` through the internal
   `renderPieThemeCss()` adapter. Package builds stale-check rather than rewrite
   source; `color-schemes.css` emits one unlayered rule per built-in.
7. Replace raw-table tests with interface-level resolution, registration,
   observation, generation, computed-style, and forced-colors coverage.
8. Update package docs, PIE-727 artifacts, consumer notes, and patch changesets
   for `@pie-players/pie-theme` and `@pie-players/pie-tool-theme`.

Host A keeps its literal four `dist/*.css` paths, live token names, unlayered
cascade and `!important` leverage, explicit-light behavior, and root-entry
self-registration. Host V keeps explicit-light behavior and the side-effect-free
`theme-element` entrypoint. The internally controlled reference host is not a
design constraint; its unavailable checkout is noted without treating it as a
reason to retain the old raw scheme interface.

## Player Surface Plan

1. Section-player tabs and collapsed splitpane chrome — partly landed. Tab hooks
   stay component-scoped and light-DOM classes and `data-pie-purpose` aliases are
   preserved. `section-theme-color-scheme.spec.ts` asserts the toggle's selected
   and unselected legibility across every built-in scheme. Open: hover, disabled
   and focus-visible states, and a representative host override.
2. Section-player scroll fades and scrollbars — landed. `--pie-scrollbar-*` was
   classified package-private rather than promoted, because no theme or scheme
   sets it; the fallback chain is the contract. The scroll hint's page-coloured
   fill resolves through `--pie-white` (2bcd9faf); no assertion covers the
   gradient yet, so its matrix row stays `Planned`.
3. Assessment-player navigation — open:
   - Keep `--pie-background-light` classified as unsupported unless promoted by
     decision record; it is not an external compatibility requirement.
   - Add browser computed-style coverage before changing nav button colors,
     focus outlines, or target sizing.
4. Assessment-toolkit item toolbar — landed (2bcd9faf, 2a741c6b). Ordinary
   controls resolve through canonical `--pie-button-*` chains;
   `--pie-tool-trigger-active-*` is the component-scoped set for selected and
   open states.

## Tool Surface Plan

1. Inline TTS — partly landed. Active/open trigger hooks are the model for local
   tool states, panel chrome and glyph paint from the theme, and Host A's
   observed `--pie-button-background-color` alias is preserved; other historical
   aliases do not justify new compatibility paths. Open: the speed control's
   `aria-checked` state emphasises with `--pie-primary` and has no
   component-scoped hook, so a host cannot style it independently.
2. Calculator inline — landed. `--pie-tool-trigger-active-*` is the public
   active/open hook set, with structural and scheme coverage in the package's
   style-contract test.
3. Floating tools — inventory complete as of 2026-08-15: no colour literals
   remain outside `var(--pie-*)` fallback chains in any `packages/tool-*` source,
   and the periodic table's cells landed in e8a6f0ec. Open: documenting each
   package's private hooks in its own README and, for any hook promoted to
   public, in the registry.

## Verification Matrix

| Slice | Required Checks |
| --- | --- |
| Theme contract tests | `bun run check:theme-tokens`; `bun --cwd packages/theme run check:generated-css`; `bun test --dom packages/theme/tests` |
| Scheme runtime | Interface-level tests for precedence, complete built-ins, custom-entry atomicity, unavailable request retention, late registration, immutable snapshots, notification cardinality, listener isolation, and receipt generations |
| Theme picker | Package tests plus browser coverage for live catalog changes, disabled/announced unavailable state, derived previews, and forced-colors behavior without `forced-color-adjust: none` |
| Player chrome source changes | Package-local structural tests; WCAG matrix row update; Playwright computed-style checks outside the sandbox; relevant package build before consumer validation |
| Tool source changes | Package-local style-contract tests; README and registry updates for new public hooks; targeted package build |
| Custom-element or export changes | `bun run check:source-exports`; `bun run check:consumer-boundaries`; `bun run check:custom-elements` |
| Release-oriented validation | Patch changesets for changed publishable packages; `bun run check:changeset-patch-only`; `bun run check:fixed-versioning` |
| Final broad integration | `bun run verify:local-pr` outside the sandbox when Playwright coverage is required |

## Changeset Rule

Source or public-contract changes need patch changesets for each changed
publishable package. Because PIE Players uses fixed lockstep versioning, the
release process still bumps all publishable `@pie-players/*` packages together.
This coordinated slice names both `@pie-players/pie-theme` and
`@pie-players/pie-tool-theme` at patch level.
