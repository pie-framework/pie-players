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
| Component-public | `--pie-tool-trigger-active-*`, section tab hooks, annotation hooks, and the five TTS reading-highlight tokens | Owned by component packages but discoverable in `packages/theme/src/token-registry.json`; optional Scheme Participants unless their normal fallback cannot remain accessible. The annotation outline and two underline tokens are required. The five TTS reading-highlight tokens are `excluded`: the highlight coordinator derives them from the resolved theme at runtime, so no scheme value applies. |
| Legacy/component aliases | `--pie-button-background-color`, `--pie-button-border-color`, `--pie-button-hover-background-color`, `--pie-focus-ring-color` | Host A's observed `--pie-button-background-color` remains a compatibility contract. The other names are classified historical paths, not reasons to add or retain further shims. All are excluded from Scheme Participation. |
| Unsupported or intentional gaps | `--pie-background-light` | Do not treat as canonical until promoted by decision record; current usage falls back through `--pie-background`. |
| Package-private or future public hooks | annotation highlight tokens, TTS panel chrome tokens, the three scrollbar hooks `--pie-scrollbar-thumb`, `--pie-scrollbar-thumb-hover` and `--pie-scrollbar-track`, `--pie-section-player-focus-outline`, `--pie-shadow` | Leave package-scoped unless a source-changing slice documents them as public and adds registry/docs/tests. The scrollbar three are registered as `package-private` with `excluded` participation: no theme or scheme sets a value, so each one's fallback chain is the contract rather than its name. |
| Package-private layout handoffs | `--pie-section-player-layout-max-width`, `--pie-section-player-tab-zoom-comp`, `--pie-toolbar-tools-row-height`, `--pie-tts-controls-row-height` | Geometry passed between a component and its own subtree, set from props or measured at runtime, never a palette value and never a host hook. Hosts reach the same behaviour through documented max-width attributes and toolbar size inputs; overriding these directly desynchronises the component from the measurement it made. All are `excluded` from Scheme Participation. |

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

## Registry admission

A `--pie-*` name earns a `token-registry.json` entry when a host sets it, or when
package documentation tells a host to set it. Every other name stays in the
`PACKAGE_PRIVATE_SOURCE_TOKENS` allowlist in `scripts/check-theme-tokens.mjs`.

Existing in source is not the test. Applied on 2026-08-02 it published seventeen
entries covering zoom compensations, panel shadows and button sizing, sixteen of
which were withdrawn the next day (#153, #162) and have been allowlisted since.
The five TTS reading-highlight tokens registered on 2026-08-28 pass the rule: the
Angular delivery declares all five. The nine remaining geometry handoffs fail it
and stay allowlisted, because registering them would buy symmetry and no signal.

Two corollaries follow from the entry being a promise:

- The README that names a token says which side of the line it falls on.
  `tool-line-reader/README.md` states the contract for
  `--pie-tool-line-reader-outline-color`; `calculator-cortex/README.md` and
  `tool-tts-inline/README.md` carry the same statement over their package hooks.
- Documenting a token to hosts while leaving it unregistered is the same defect
  read from the other end. Register it or withdraw the offer.

## Token stability

Names and values are stable by default, and the record holds: between 2026-07-07
and 2026-08-28 no registered name was renamed or dropped, and two commits changed
a value a host renders — `1f29de7f` repaired six base-theme colours and six
scheme values against WCAG, and `16926137` moved one scheme's
`--pie-blue-grey-300`.

A rendered value changes on a measured accessibility failure or a host-visible
defect, named in the changeset along with the relationship it repairs.
`theme-definition-contract.test.ts` asserts `diagnoseThemeContrast` returns empty
for both base themes and all ten schemes, so a palette edit that is not repairing
a diagnosed failure is changing certified output.

A registered name is not renamed or dropped. Reclassifying one is a contract
change on the same footing: `component-public` to `package-private` withdraws a
promise a host may already hold, so it takes the consumer-pad check that a rename
would.

## Follow-Up Inventory Rules

- A `--pie-*` variable that passes **Registry admission** above requires a token
  registry entry, owning package README docs, package-local tests, and a patch
  changeset. One that fails it requires an allowlist line and nothing else.
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
