# PIE-727 Theme Token Inventory

Status: Draft

Owner: PIE Players maintainers

Related:

- [PIE-727 Broad Theming Contract](../prds/pie-727-broad-theming-contract.md)
- [PIE-727 Theming WCAG Matrix](./pie-727-theming-wcag-matrix.md)

## Purpose

This inventory records the current `--pie-*` token surface discovered during the
PIE-727 broad theming pass. It is not a rename plan. Existing public token names
remain compatibility contracts; unsafe or ambiguous names should be routed
through safer fallback chains or classified before new use.

The inventory command used for this slice scanned source and docs with
`rg -- "--pie-[A-Za-z0-9-]+"`, excluding build output, lockfiles, uploaded plan
snapshots, and this PIE-727 documentation set.

The ongoing gate is `bun run check:theme-tokens`. It verifies that registry
entries point to actual source/docs, canonical defaults stay aligned with CSS
defaults and color schemes, and source token usage is either registered or
explicitly classified as package-private.

## Summary

- Token-like names found: 95.
- Names with at least one in-repo declaration: 56.
- Names with no in-repo declaration: 39.
- Names appearing in more than one file: 85.
- Canonical runtime defaults: 48 tokens in
  `packages/theme/src/theme-defaults.ts`.
- Canonical CSS defaults: `packages/theme/src/tokens.css`, now parity-tested
  against runtime defaults.
- Built-in color schemes: `packages/theme/src/color-schemes.ts` and
  `packages/theme/src/color-schemes.css`, now checked to use registered tokens.
- DaisyUI bridge mappings: covered by
  `packages/theme-daisyui/tests/mapping-parity.test.mjs`.

Some regex matches are documentation placeholders rather than real token names,
for example `--pie-button-`, `--pie-focus-`, and
`--pie-tool-trigger-active-`. Do not promote these to registry entries.

## Classification

| Class | Tokens | Contract |
| --- | --- | --- |
| Canonical semantic | `--pie-text`, `--pie-background`, `--pie-primary`, feedback, border, neutral, focus-checked, and `--pie-button-*` defaults from `theme-defaults.ts` | Owned by `@pie-players/pie-theme`; source-compatible with existing QE and host overrides. |
| Component-public | `--pie-tool-trigger-active-*`, section tab hooks such as `--pie-section-player-tab-active-background` | Owned by component packages but discoverable in `packages/theme/src/token-registry.json`; must have README docs and tests. |
| Legacy/component aliases | `--pie-button-background-color`, `--pie-button-border-color`, `--pie-button-hover-background-color`, `--pie-focus-ring-color` | Keep working; route through canonical button/focus tokens before broad semantic fallbacks. |
| Unsupported or intentional gaps | `--pie-background-light` | Do not treat as canonical until promoted by decision record; current usage falls back through `--pie-background`. |
| Package-private or future public hooks | annotation highlight tokens, TTS highlight tokens, scrollbar tokens, `--pie-section-player-focus-outline`, `--pie-surface`, `--pie-shadow` | Leave package-scoped unless a source-changing slice documents them as public and adds registry/docs/tests. |

## High-Risk Findings

1. `packages/tool-tts-inline/tool-tts-inline.svelte` used
   `--pie-button-background-color`, `--pie-button-border-color`, and
   `--pie-button-hover-background-color` as direct aliases that skipped the
   canonical `--pie-button-*` chain. This slice preserves those names and routes
   them through `--pie-button-bg`, `--pie-button-border`, and
   `--pie-button-hover-bg`.
2. `packages/assessment-player/src/components/AssessmentPlayerDefaultElement.ts`
   used undefined `--pie-background-light`. This slice preserves the name and
   adds a `--pie-background` fallback.
3. `packages/theme/src/components.css` used `--pie-focus-ring-color` as an
   isolated focus token. This slice classifies it as a legacy alias and routes it
   through `--pie-focus-outline` and `--pie-button-focus-outline`.
4. `packages/section-player/README.md` documented tab token names that did not
   match `SectionPlayerTabbedContent.svelte`. This slice updates the docs to the
   actual public tab hooks and registers those hooks.

## Follow-Up Inventory Rules

- New public `--pie-*` variables require a token registry entry, owning package
  README docs, package-local tests, and a patch changeset.
- Existing public names should not be removed or collapsed in bulk.
- Ambiguous tokens should be classified as `legacy`, `unsupported`, or
  `package-private` before any source-changing use.
- Component-scoped hooks should be added only when existing semantic tokens and
  `--pie-button-*` chains are not sufficient for a safe host integration point.
