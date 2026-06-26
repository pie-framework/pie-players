# PIE-727 Theming Implementation Slices

Status: Draft

Owner: PIE Players maintainers

Related:

- [PIE-727 Broad Theming Contract](../prds/pie-727-broad-theming-contract.md)
- [PIE-727 Theme Token Inventory](./pie-727-theme-token-inventory.md)
- [PIE-727 Theming WCAG Matrix](./pie-727-theming-wcag-matrix.md)

## Slice Rules

- Preserve existing public `--pie-*` names and fallback behavior.
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
| Token registry and parity | `@pie-players/pie-theme` | Added registry entries for canonical defaults, inline trigger hooks, section tab hooks, legacy aliases, and decision-gate tokens. Added parity checks for `theme-defaults.ts`, `tokens.css`, color schemes, and focus alias fallback. | `bun test packages/theme/tests/token-registry-contract.test.ts` |
| Theme shared focus wrappers | `@pie-players/pie-theme` | Routed `--pie-focus-ring-color` through `--pie-focus-outline` and `--pie-button-focus-outline`. | `bun test packages/theme/tests/token-registry-contract.test.ts` |
| Assessment navigation backgrounds | `@pie-players/pie-assessment-player` | Preserved `--pie-background-light` but added `--pie-background` fallback. | `bun test packages/assessment-player/tests/assessment-player-theme-contract.test.ts` |
| Section tabs docs/registry | `@pie-players/pie-section-player` | Documented actual tab CSS variables and registered them as component-public hooks. | `bun test packages/section-player/tests/section-player-theme-token-docs.test.ts` |
| TTS inline button aliases | `@pie-players/pie-tool-tts-inline` | Preserved `--pie-button-*-color` style aliases while routing through canonical `--pie-button-*` fallbacks. | `bun test packages/tool-tts-inline/tests/tool-tts-inline-style-contract.test.ts` |

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
   - Keep `--pie-background-light` as an unsupported compatibility alias unless
     promoted by decision record.
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
   - Preserve legacy button alias names while routing through canonical button
     tokens.
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
| Theme contract tests | `bun run check:theme-tokens`; `bun test packages/theme/tests/token-registry-contract.test.ts`; `bun test packages/theme/src/theme-element.test.ts`; `bun test packages/theme-daisyui/tests/mapping-parity.test.mjs` |
| Player chrome source changes | Package-local structural tests; WCAG matrix row update; Playwright computed-style checks outside the sandbox; relevant package build before consumer validation |
| Tool source changes | Package-local style-contract tests; README and registry updates for new public hooks; targeted package build |
| Custom-element or export changes | `bun run check:source-exports`; `bun run check:consumer-boundaries`; `bun run check:custom-elements` |
| Release-oriented validation | Patch changesets for changed publishable packages; `bun run check:changeset-patch-only`; `bun run check:fixed-versioning` |
| Final broad integration | `bun run verify:local-pr` outside the sandbox when Playwright coverage is required |

## Changeset Rule

Source or public-contract changes need patch changesets for each changed
publishable package. Because PIE Players uses fixed lockstep versioning, the
release process still bumps all publishable `@pie-players/*` packages together.
