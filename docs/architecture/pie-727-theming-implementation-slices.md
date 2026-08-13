# PIE-727 Theming Implementation Slices

Status: Draft

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

## Completed In This Slice

| Surface | Package | Change | Verification |
| --- | --- | --- | --- |
| Token registry and parity | `@pie-players/pie-theme` | Added registry entries for canonical defaults, inline trigger hooks, section tab hooks, legacy aliases, and decision-gate tokens. Added parity checks for `theme-definitions.ts`, generated CSS, Scheme Participation, and focus alias fallback. | `bun test packages/theme/tests/token-registry-contract.test.ts` |
| Theme shared focus wrappers | `@pie-players/pie-theme` | Routed `--pie-focus-ring-color` through `--pie-focus-outline` and `--pie-button-focus-outline`. | `bun test packages/theme/tests/token-registry-contract.test.ts` |
| Assessment navigation backgrounds | `@pie-players/pie-assessment-player` | Preserved `--pie-background-light` but added `--pie-background` fallback. | `bun test packages/assessment-player/tests/assessment-player-theme-contract.test.ts` |
| Section tabs docs/registry | `@pie-players/pie-section-player` | Documented actual tab CSS variables and registered them as component-public hooks. | `bun test packages/section-player/tests/section-player-theme-token-docs.test.ts` |
| TTS inline button aliases | `@pie-players/pie-tool-tts-inline` | Preserved `--pie-button-*-color` style aliases while routing through canonical `--pie-button-*` fallbacks. | `bun test packages/tool-tts-inline/tests/tool-tts-inline-style-contract.test.ts` |

## Coordinated Canonical Theme Slice

The theme architecture lands as one coordinated source-changing slice because
splitting it would temporarily recreate the duplicate source of truth it removes.

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

1. Section-player tabs and collapsed splitpane chrome:
   - Keep tab hooks component-scoped.
   - Add computed-style Playwright coverage for default/active/focus-visible
     states under light, dark, high-contrast scheme, and a representative host
     override.
   - Preserve light-DOM classes and `data-pie-purpose` aliases.
2. Section-player scroll fades and scrollbars:
   - Classify `--pie-scrollbar-*` and any fade tokens before making them public.
   - Replace hardcoded fade colors with background-derived fallbacks only in a
     focused source-changing slice.
3. Assessment-player navigation:
   - Keep `--pie-background-light` classified as unsupported unless promoted by
     decision record; it is not an external compatibility requirement.
   - Add browser computed-style coverage before changing nav button colors,
     focus outlines, or target sizing.
4. Assessment-toolkit item toolbar:
   - Prefer canonical `--pie-button-*` chains for ordinary controls.
   - Introduce component-scoped hooks only for selected/open states that hosts
     need to style independently of broad semantic tokens.

## Tool Surface Plan

1. Inline TTS:
   - Keep active/open trigger hooks as the model for local tool states.
   - Treat speed-control active state as a separate focused slice if hosts need
     independent styling from `--pie-primary`.
   - Preserve Host A's observed `--pie-button-background-color` alias. Other
     historical aliases do not justify new compatibility paths.
2. Calculator inline:
   - Keep `--pie-tool-trigger-active-*` as the public active/open hook set.
   - Add computed-style coverage only if visual behavior changes beyond the
     structural contract test.
3. Floating tools:
   - Split graph, ruler, periodic table, line-reader, and text-to-speech panel
     work into package groups.
   - Inventory each package's hardcoded colors and private hooks before adding
     public variables.
   - Document every new public hook in the owning README and registry.

## Verification Matrix

| Slice | Required Checks |
| --- | --- |
| Theme contract tests | `bun run check:theme-tokens`; `bun --cwd packages/theme run check:generated-css`; `bun test --dom packages/theme/tests`; `bun test packages/theme-daisyui/tests/mapping-parity.test.mjs` |
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
