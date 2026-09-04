# PIE-727 Theme Token Inventory

Status: Draft

Owner: PIE Players maintainers

Related:

- [PIE-727 Broad Theming Contract](../prds/pie-727-broad-theming-contract.md)
- [PIE-727 Theming WCAG Matrix](./pie-727-theming-wcag-matrix.md)

## Purpose

This inventory records the current `--pie-*` token surface discovered during the
PIE-727 broad theming pass. It is not a rename plan. Token names recorded for an
external host remain compatibility contracts; historic-only names are classified
but do not acquire new shims merely because they exist in the repository.

The inventory command used for this slice scanned source and docs with
`rg -- "--pie-[A-Za-z0-9-]+"`, excluding build output, lockfiles, uploaded plan
snapshots, and this PIE-727 documentation set.

The ongoing gate is `bun run check:theme-tokens`. It verifies that registry
entries point to actual source/docs, Scheme Participation matches the canonical
theme definition, generated CSS is current, and source token usage is either
registered or explicitly classified as package-private.

## Summary

Counts are the PIE-727 scan snapshot, not a live figure: the token surface has
grown with each chrome slice, and `token-registry.json` holds 86 entries as of
2026-08-15. `bun run check:theme-tokens` is the authority on what exists.

- Token-like names found: 95.
- Names with at least one in-repo declaration: 56.
- Names with no in-repo declaration: 39.
- Names appearing in more than one file: 85.
- Canonical semantic family: 48 tokens; 47 are color tokens required in built-in
  schemes and `--pie-font-scale` is excluded from Scheme Participation. The
  resolved base definition also supplies the three required component-public
  annotation tokens, for 51 values in all.
- Built-in color schemes: ten explicitly authored, complete palettes. Each owns
  all 47 required canonical color tokens plus the three required
  component-public annotation tokens.
- CSS adapters: `packages/theme/src/tokens.css` and
  `packages/theme/src/color-schemes.css` are checked-in generated output, not
  parallel sources of palette values.
- DaisyUI slot mappings: `DAISYUI_PIE_TOKEN_MAP` is the sole source, covered by
  `packages/theme/tests/daisyui-mapping.test.ts`.

Some regex matches are documentation placeholders rather than real token names,
for example `--pie-button-`, `--pie-focus-`, and
`--pie-tool-trigger-active-`. Do not promote these to registry entries.

## Classification

| Class | Tokens | Contract |
| --- | --- | --- |
| Canonical semantic | `--pie-text`, `--pie-background`, `--pie-primary`, feedback, border, neutral, focus-checked, `--pie-surface`, and `--pie-button-*` defaults | Owned by `@pie-players/pie-theme`; the active color tokens are required Scheme Participants. Existing Host A token names and fallback behavior remain source-compatible. |
| Component-public | `--pie-tool-trigger-active-*`, section tab hooks, and annotation hooks | Owned by component packages but discoverable in `packages/theme/src/token-registry.json`; optional Scheme Participants unless their normal fallback cannot remain accessible. The annotation outline and two underline tokens are required. |
| Legacy/component aliases | `--pie-button-background-color`, `--pie-button-border-color`, `--pie-button-hover-background-color`, `--pie-focus-ring-color` | Host A's observed `--pie-button-background-color` remains a compatibility contract. The other names are classified historical paths, not reasons to add or retain further shims. All are excluded from Scheme Participation. |
| Unsupported or intentional gaps | `--pie-background-light` | Do not treat as canonical until promoted by decision record; current usage falls back through `--pie-background`. |
| Package-private or future public hooks | annotation highlight tokens, TTS highlight tokens, scrollbar tokens, `--pie-section-player-focus-outline`, `--pie-shadow` | Leave package-scoped unless a source-changing slice documents them as public and adds registry/docs/tests. |

## High-Risk Findings

1. `packages/tool-tts-inline/tool-tts-inline.svelte` used
   `--pie-button-background-color`, `--pie-button-border-color`, and
   `--pie-button-hover-background-color` as direct aliases that skipped the
   canonical `--pie-button-*` chain. An earlier slice routed them through
   `--pie-button-bg`, `--pie-button-border`, and `--pie-button-hover-bg`.
   Only the background-color alias is an observed external dependency.
2. `packages/assessment-player/src/components/AssessmentPlayerDefaultElement.ts`
   used undefined `--pie-background-light`. An earlier slice classified it as
   unsupported and added a `--pie-background` fallback; it is not an observed
   external dependency.
3. `packages/theme/src/components.css` used `--pie-focus-ring-color` as an
   isolated focus token. An earlier slice classified it as a legacy alias and
   routed it through `--pie-focus-outline` and
   `--pie-button-focus-outline`; it is not an observed external dependency.
4. `packages/section-player/README.md` documented tab token names that did not
   match `SectionPlayerTabbedContent.svelte`. This slice updates the docs to the
   actual public tab hooks and registers those hooks.
5. Built-in palettes were split across TypeScript and CSS. Each CSS palette had
   24 values absent from the runtime definition, while each runtime definition
   had 11 values absent from the CSS. The shared `rose-on-green --pie-black`
   value also disagreed (`#000000` in CSS, `#3d0022` at runtime). The canonical
   complete palette uses `#3d0022` and generates both adapters.
6. Several light/dark Base Theme defaults and six built-in feedback values did
   not meet the semantic relationship implied by their actual use as text,
   icons, boundaries, or annotation marks. The canonical definitions use
   role-appropriate passing values and test every named relationship;
   token names and host override leverage are unchanged.

## Scheme Participation

Every registry entry declares `required`, `optional`, or `excluded`:

- `required`: active canonical color tokens, plus the annotation toolbar
  outline and light/dark annotation underline tokens;
- `optional`: active component-public color hooks that a palette may override;
- `excluded`: typography, package-private, legacy, unsupported, planned,
  deprecated, and non-color entries.

Built-ins must define every required token with an explicit value. Registered
custom schemes are partial, but may name only required or optional tokens.
Other one-off values belong in `<pie-theme>.variables` or deliberate host CSS.

## Follow-Up Inventory Rules

- New public `--pie-*` variables require a token registry entry, owning package
  README docs, package-local tests, and a patch changeset.
- Preserve existing names when the consumer pad records a client-facing
  dependency. Do not add compatibility paths for unobserved legacy interfaces.
- Ambiguous tokens should be classified as `legacy`, `unsupported`, or
  `package-private` before any source-changing use.
- Component-scoped hooks should be added only when existing semantic tokens and
  `--pie-button-*` chains are not sufficient for a safe host integration point.
- Update the TypeScript definition, run
  `bun --cwd packages/theme run generate:css`, and commit both generated CSS
  adapters together. `bun --cwd packages/theme run check:generated-css` and
  `bun run check:theme-tokens` must pass without modifying files.
