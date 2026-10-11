# Theme Token Inventory

Status: Active

Owner: PIE Players maintainers

Related:

- [Broad theming contract](../prds/pie-727-broad-theming-contract.md)
- [Theming WCAG matrix](./pie-727-theming-wcag-matrix.md)
- [`@pie-players/pie-theme` token registry](../../packages/theme/README.md#token-registry)

## Purpose

This inventory classifies the `--pie-*` token surface for contributors who add,
change or retire a token, and sets out the procedure each change follows. The
host-facing admission and stability rules are in the
[theme README](../../packages/theme/README.md#token-registry). Token names
recorded for an external host are compatibility contracts; a historic-only name
is classified but acquires no shim merely because it exists in the repository.

`bun run check:theme-tokens` is the gate and the authority on what exists. It
verifies that registry entries point to actual source and docs, that Scheme
Participation matches the canonical theme definition, that generated CSS is
current, and that source token usage is either registered or explicitly
classified as package-private.

## Sources of truth

- Base themes and the ten built-in color schemes are authored once in
  TypeScript, as complete palettes. Each built-in owns every token whose Scheme
  Participation is `required`.
- `packages/theme/src/tokens.css` and `packages/theme/src/color-schemes.css` are
  checked-in generated output, not parallel sources of palette values.
- `DAISYUI_PIE_TOKEN_MAP` is the sole source of the DaisyUI slot mappings,
  covered by `packages/theme/tests/daisyui-mapping.test.ts`.

Prefix placeholders such as `--pie-button-`, `--pie-focus-` and
`--pie-tool-trigger-active-` name a family in prose and comments. Do not promote
them to registry entries.

## Classification

| Class | Tokens | Contract |
| --- | --- | --- |
| Canonical semantic | `--pie-text`, `--pie-background`, `--pie-primary`, feedback, border, neutral, focus-checked, `--pie-surface`, and `--pie-button-*` defaults | Owned by `@pie-players/pie-theme`; the active color tokens have Scheme Participation `required`. `--pie-font-scale` is the one active entry `excluded` from it. |
| Component-public | `--pie-tool-trigger-active-*`, section tab hooks, annotation hooks, and the five TTS reading-highlight tokens | Owned by component packages but discoverable in `packages/theme/src/token-registry.json`; Scheme Participation `optional` unless their normal fallback cannot remain accessible. The annotation outline and two underline tokens are `required`. The five TTS reading-highlight tokens are `excluded`: the highlight coordinator derives them from the resolved theme at runtime, so no scheme value applies. |
| Legacy/component aliases | `--pie-button-background-color`, `--pie-button-hover-background-color`, `--pie-focus-ring-color` | `--pie-button-background-color` is an observed host dependency, recorded in the [consumer API dependencies](../integrations/consumer-api-dependencies.md) record, and remains a compatibility contract; the TTS inline tool reads only this alias. `--pie-button-hover-background-color` remains on the calculator inline tool alone. Both are registered as `component-public` and fall back through the canonical `--pie-button-*` chain. `--pie-focus-ring-color` is the one `legacy` entry: no host is observed using it, and `components.css` routes it through `--pie-focus-outline` and `--pie-button-focus-outline`. None of the three is a reason to add or retain further shims. All are excluded from Scheme Participation. |
| Package-private or future public hooks | annotation highlight tokens, TTS panel chrome tokens, the three scrollbar hooks `--pie-scrollbar-thumb`, `--pie-scrollbar-thumb-hover` and `--pie-scrollbar-track`, `--pie-section-player-focus-outline`, `--pie-shadow` | Stay package-scoped until a change documents one as public and adds its registry entry, docs and tests. The scrollbar three are registered as `package-private` with `excluded` participation: no theme or scheme sets a value, so each one's fallback chain is the contract rather than its name. |
| Package-private layout handoffs | `--pie-section-player-layout-max-width`, `--pie-toolbar-tools-row-height`, `--pie-tts-controls-row-height` | Geometry passed between a component and its own subtree, set from props or measured at runtime, never a palette value and never a host hook. Hosts reach the same behavior through documented max-width attributes and toolbar size inputs; overriding these directly desynchronizes the component from the measurement it made. All are `excluded` from Scheme Participation. |

`--pie-section-player-tab-zoom-comp` stays in the registry as `deprecated` and
affects no layout: tabs follow native browser scaling and the responsive layout,
because its width-ratio estimator mistook constrained hosts for browser zoom and
shrank controls below usable sizes.

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

The admission rule is in the
[theme README](../../packages/theme/README.md#token-registry): a `--pie-*` name
earns a `token-registry.json` entry when a host sets it, or when package
documentation tells a host to set it. Eight `package-private` entries are
registered as well: the section player's three scrollbar hooks, whose fallback
chain is the contract; the `--pie-content-styles` presence sentinel; and four
sizing and layout handoffs, one of them retired. Every other name stays in the
`PACKAGE_PRIVATE_SOURCE_TOKENS` allowlist in `scripts/check-theme-tokens.mjs`.

Existing in source is not the test: applied that way, it once published
seventeen entries covering zoom compensations, panel shadows and button sizing,
and sixteen were withdrawn the next day. The five TTS reading-highlight tokens
pass the rule, because a host sets all five. The remaining geometry handoffs
fail it and stay allowlisted, because registering them would buy symmetry and
no signal.

Two corollaries follow from the entry being a promise:

- The README that names a token says which side of the line it falls on.
  `tool-line-reader/README.md` states the contract for
  `--pie-tool-line-reader-outline-color`; `calculator-cortex/README.md` and
  `tool-tts-inline/README.md` carry the same statement over their package hooks.
- Documenting a token to hosts while leaving it unregistered is the same defect
  read from the other end. Register it or withdraw the offer.

## Token stability

The stability rule is in the
[theme README](../../packages/theme/README.md#token-registry): registered names
and values are stable by default.

A rendered value changes on a measured accessibility failure or a host-visible
defect, named in the changeset along with the relationship it repairs.
`theme-definition-contract.test.ts` asserts `diagnoseThemeContrast` returns empty
for both base themes and all ten schemes, so a palette edit that is not repairing
a diagnosed failure is changing certified output.

A registered name is not renamed or dropped. Reclassifying one is a contract
change on the same footing: `component-public` to `package-private` withdraws a
promise a host may already hold, so it takes the same check against the
[consumer API dependencies](../integrations/consumer-api-dependencies.md) record
that a rename would.

## Change rules

- A `--pie-*` variable that passes **Registry admission** above requires a token
  registry entry, owning package README docs, package-local tests, and a patch
  changeset. One that fails it requires an allowlist line and nothing else.
- Preserve existing names when the consumer API dependencies record shows a
  client-facing dependency. Do not add compatibility paths for unobserved legacy
  interfaces.
- Classify an ambiguous token as `legacy` or `package-private` before any
  source-changing use.
- Add a component-scoped hook only when existing semantic tokens and
  `--pie-button-*` chains are not sufficient for a safe host integration point.
- Update the TypeScript definition, run
  `bun --cwd packages/theme run generate:css`, and commit both generated CSS
  adapters together. `bun --cwd packages/theme run check:generated-css` and
  `bun run check:theme-tokens` must pass without modifying files.
