# Broad Theming Contract

Status: Accepted, 2026-08-15

Implementation status: shipped in pie-players: the side-effect-free canonical
definition, Scheme Participation metadata, the runtime color-scheme interface,
generated `tokens.css` and `color-schemes.css` behind a stale-output check, the
published token registry, and the color-scheme tool (`theme`) observing the
catalog. Per-surface chrome records live in the
[theming WCAG matrix](../architecture/pie-727-theming-wcag-matrix.md).

Owner: PIE Players maintainers

This PRD defines the `--pie-*` theme token contract: token scopes and the
registry that records them, the runtime color-scheme interface, resolution order,
the generated CSS adapters, and the host surfaces the contract preserves. It is
for maintainers of `@pie-players/pie-theme` and of themed player and tool chrome.
Terms follow the [theme language](../../CONTEXT.md#theme-language).

Related architecture:

- [Developer patterns](../architecture/developer_patterns.md)
- [Accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md)
- [Section player integration guide](../section-player/integration-guide.md)
- [Theme token inventory](../architecture/pie-727-theme-token-inventory.md)
- [Theming WCAG matrix](../architecture/pie-727-theming-wcag-matrix.md)

Integrator guides: [How theming works](../theming/how-theming-works.md) and the
[`@pie-players/pie-theme` README](../../packages/theme/README.md), which is the
runtime API reference.

## Problem

Hosts could override broad semantic theme tokens such as `--pie-primary` to
style one local control state, and break unrelated selected, active or focused
UI in doing so; a host styling regression showed it. Component-scoped
active/open trigger hooks for the inline TTS and calculator tools fixed that
case, but the repository still had separate TypeScript and CSS palette sources,
no observable custom-scheme catalog, and partial WCAG validation for
theme-sensitive chrome.

Hosts needed a durable contract for theming player and tool surfaces without
broad-token overrides that reach assessment-taking UI.

## Goals

- Define a machine-checkable `--pie-*` token contract for canonical semantic
  tokens, component-scoped public hooks, package-private fallbacks and legacy
  tokens.
- Make one side-effect-free TypeScript definition the source of truth for base
  themes and complete built-in color schemes.
- Publish a small operational interface for resolving themes and observing or
  registering custom schemes without publishing raw palette tables.
- Keep requested and resolved scheme state distinct so an unavailable
  preference survives removal and late registration.
- Generate the checked-in `tokens.css` and `color-schemes.css` adapters from the
  canonical definition and reject stale output without rewriting it in builds.
- Require a checked-in WCAG and computed-style coverage matrix for every touched
  visible theming surface.
- Preserve the theming surfaces that Host A and Host V, consumers in the
  [consumer API dependencies](../integrations/consumer-api-dependencies.md)
  record, depend on: live token names and override leverage, literal CSS
  artifact paths, explicit-light behavior, and theme entrypoint side effects.
- Make new theming hooks and style changes follow established local patterns
  first: existing semantic tokens, existing button token chains, package-local
  README documentation, package-local style-contract tests, and additive
  fallback behavior. A new naming pattern needs a decision record.
- Keep WCAG 2.2 Level AA expectations explicit for text contrast, non-text
  contrast, focus visibility, keyboard access, high contrast, zoom, and target
  size where applicable.

## Non-Goals

- No replacement of DaisyUI or redesign of every theme name.
- No client-specific selectors or host-specific fixes in PIE Players.
- No change to the broad semantic meaning of `--pie-primary`,
  `--pie-background`, `--pie-text`, or feedback tokens to satisfy one local
  control state.
- No compatibility aliases or transitional runtime alongside the canonical
  interface. Legacy behavior is retained only when an observed external
  dependency requires it.
- No algorithmically generated palettes; built-in values are explicitly
  authored and reviewed.
- No claim of WCAG certification or assistive technology support beyond the
  test and manual evidence the WCAG matrix records.
- No persisted model, session, assessment, scoring, or standards-adapter schema
  changes.

## Package And Export Ownership

- Owning package: `@pie-players/pie-theme` owns the canonical token registry and
  semantic token contract.
- Public export path: `@pie-players/pie-theme` owns the operational TypeScript
  interface and token-registry types; `@pie-players/pie-theme/token-registry.json`
  publishes the registry; the CSS subpaths are output adapters.
- Consuming packages or apps: `@pie-players/pie-section-player`,
  `@pie-players/pie-assessment-player`,
  `@pie-players/pie-assessment-toolkit`, `@pie-players/pie-tool-*`,
  `@pie-players/pie-section-player-tools-*`, demo apps, and external hosts
  through their package and custom-element interfaces.
- Runtime environment: browser custom elements and Svelte components compiled as
  custom elements. Some surfaces use shadow DOM and some intentionally use light
  DOM.

Component-scoped public hooks remain owned by their component package and are
listed in the `@pie-players/pie-theme` token registry, so hosts can discover the
full public theming contract in one place.

## Contract Shape

The root entrypoint exports this operational interface. Every exported type is
read-only. The [theme README](../../packages/theme/README.md#runtime-theme-interface)
documents the operations for integrators.

```ts
type ThemeTokenName = `--pie-${string}`;
type ThemeVariables = Record<string, string>;

type PieThemeResolutionStatus =
  | "default"
  | "built-in"
  | "custom"
  | "unavailable";

interface PieColorSchemePreview {
  bg: string;
  text: string;
  primary: string;
}

interface PieColorSchemeDescriptor {
  id: string;
  name: string;
  description?: string;
  kind: "default" | "built-in" | "custom";
  preview: PieColorSchemePreview;
}

interface ColorSchemeSnapshot {
  generation: number;
  schemes: readonly PieColorSchemeDescriptor[];
}

interface ResolvePieThemeInput {
  baseTheme?: "light" | "dark";
  requestedScheme?: string | null;
  providerVariables?: Readonly<ThemeVariables>;
  variables?: Readonly<ThemeVariables>;
}

interface ThemeResolution {
  baseTheme: "light" | "dark";
  requestedScheme: string;
  resolvedScheme: PieColorSchemeDescriptor | null;
  status: PieThemeResolutionStatus;
  variables: Readonly<ThemeVariables>;
  /** The CSS `color-scheme` keyword the resolution implies; `null` without a scheme. */
  colorScheme: "light" | "dark" | null;
  diagnostics: readonly PieThemeDiagnostic[];
}

type PieThemeDiagnosticCode =
  | "unknown-scheme"
  | "invalid-registration"
  | "invalid-scheme-id"
  | "reserved-scheme-id"
  | "empty-scheme"
  | "invalid-token-name"
  | "excluded-token"
  | "invalid-token-value"
  | "custom-scheme-replaced"
  | "contrast-too-low"
  | "contrast-unmeasurable"
  | "observer-error";

interface PieThemeDiagnostic {
  code: PieThemeDiagnosticCode;
  severity: "warning" | "error";
  message: string;
  index?: number;
  schemeId?: string;
  token?: string;
}

interface RegisteredPieColorScheme {
  id: string;
  name?: string;
  description?: string;
  variables: Readonly<Record<string, string | number>>;
}

interface RegistrationReceipt {
  acceptedSchemeIds: readonly string[];
  diagnostics: readonly PieThemeDiagnostic[];
  unregister(): void;
}

type Unsubscribe = () => void;
type PieThemeObserver = (snapshot: ColorSchemeSnapshot) => void;

function resolvePieTheme(input: ResolvePieThemeInput): ThemeResolution;
function listPieColorSchemes(): ColorSchemeSnapshot;
function observePieColorSchemes(
  listener: PieThemeObserver,
): Unsubscribe;
function registerPieColorSchemes(
  entries: readonly RegisteredPieColorScheme[],
): RegistrationReceipt;
```

`colorScheme` is `null` whenever no scheme resolves, so the host keeps ownership
of the CSS `color-scheme` property.

Snapshots, descriptors, previews, resolved variables, and diagnostics are
immutable. Observers receive the current snapshot immediately and one coherent
snapshot per successful catalog-changing registration or unregistration.
Listener errors are isolated; reentrant mutations notify only after the current
generation finishes.

`RegistrationReceipt.unregister()` is idempotent and generation-aware. The
latest valid registration for a custom id wins, while an older receipt cannot
remove that replacement. Invalid replacements leave the prior valid definition
intact. Each entry validates atomically, but invalid entries do not reject valid
siblings from the same batch.

The token registry entries are shaped like:

```ts
interface PieThemeTokenRegistryEntry {
  /** The custom property, including the leading `--`. */
  name: string;
  /** Package that owns the token's meaning. */
  owner: string;
  scope:
    | "canonical-semantic"
    | "component-public"
    | "package-private"
    | "legacy";
  category: string;
  status: "active" | "deprecated" | "planned";
  schemeParticipation: "required" | "optional" | "excluded";
  /** Repo-relative paths that define the token. */
  definedIn: string[];
  /** Repo-relative paths that document it. */
  documentedIn?: string[];
  /** Why the token exists and what it falls back through. */
  fallbackPolicy?: string;
}
```

`category` is a plain string so a new component category arrives with its
component. The [theme token inventory](../architecture/pie-727-theme-token-inventory.md)
owns the admission rule.

Every active canonical color token participates in a built-in scheme and is
`required`; typography, private, legacy and inactive tokens are `excluded`.
Component-public tokens are `optional` unless their ordinary fallback cannot
satisfy accessibility, so the annotation toolbar border and both annotation
underline tokens are `required`.

Built-in color schemes are complete accessibility palettes. Registered custom
schemes are partial overlays and may contain only required or optional
participating tokens. Built-in ids and `default` are reserved. Unknown,
excluded, private, and legacy token names reject the whole custom entry.
Contrast diagnostics are computed from affected semantic relationships in the
fully resolved custom palette. They are warnings, not registration blockers,
because the host owns that palette; built-in palettes must pass the same named
relationships in tests.

`default` is the first catalog descriptor and means no named scheme; it is not a
palette. An unknown requested id yields `status: "unavailable"`, keeps the
request and `data-color-scheme`, resolves no managed scheme, and renders the
base and provider result with explicit variables still applied last. Late
registration or re-registration resolves it automatically.

`data-color-scheme` stays as a selector hook and adds no managed precedence
layer. A CSS-only scheme participates in the normal cascade when the generated
stylesheets are used without a mounted `<pie-theme>`. A selector competing with
a mounted element's inline resolved tokens must use `!important`; schemes that
need managed precedence register through `registerPieColorSchemes()`.

### Resolution Order

Resolution order is base theme, provider variables, resolved scheme, then
explicit variables:

- A built-in scheme overrides every required participating provider value;
  optional component hooks keep inheriting when the built-in does not define
  them.
- An explicit variable remains final.
- Catalog previews resolve a scheme over PIE's canonical light Base Theme and
  project background, text and primary onto an opaque swatch. A color form that
  cannot render opaque and deterministically falls back to the canonical preview
  color without changing the authored variable; the
  [theme README](../../packages/theme/README.md#runtime-theme-interface) lists
  the accepted forms. Previews are never authored metadata and do not mirror a
  host-specific provider.

[How theming works](../theming/how-theming-works.md#resolution-order) explains
the order for integrators.

### Generated CSS

The package-internal `renderPieThemeCss()` renders `tokens.css` and
`color-schemes.css` from the same definitions. Generation is an explicit package
command, and `check:generated-css`, the root `check:theme-tokens` gate and the
package build reject stale output without rewriting tracked source. The
[theme README](../../packages/theme/README.md#generated-css) has the commands.

Generated `color-schemes.css` contains exactly one unlayered
`[data-color-scheme="..."]` rule per built-in. It contains no `:root`,
dark-theme, or grouped exception rules. DaisyUI remains a Theme Provider adapter
because it resolves host state rather than defining a built-in palette.

### Token Examples

- `--pie-primary` is a canonical semantic token. It represents an interactive
  brand or action color and is never repurposed as a local button background by
  hosts or component internals. It is not renamed or removed, because hosts
  consume it.
- `--pie-tool-trigger-active-background` is a component-scoped public hook. It
  lets hosts style a local active/open trigger state without changing broad
  semantic colors. New component-scoped hooks follow its pattern: precise
  component and state naming, broad-token fallbacks, README documentation, a
  registry entry, and focused style-contract tests.
- `--pie-focus-outline` is registered as a `planned` canonical focus token.
  Player chrome already reads it as a fallback; defining it is a choice between
  a canonical definition, an alias of an existing token, and component-scoped
  focus hooks.

### Legacy Tokens

- `--pie-button-background-color` is a component-public compatibility alias,
  kept because Host A sets it. The inline TTS and calculator tools read it ahead
  of `--pie-button-bg`. Its sibling `--pie-button-hover-background-color` is a
  component-public hook of the calculator inline tool only; the inline TTS tool
  reads the established `--pie-button-border` and `--pie-button-hover-bg`, and
  `--pie-button-border-color` has no reader.
- `--pie-focus-ring-color` is a `legacy` authored-content focus alias, kept for
  the image and table scroll wrappers in `components.css`, which fall back
  through `--pie-focus-outline` and `--pie-button-focus-outline`. No host
  depends on it, and it takes no part in schemes.
- `--pie-background-light` is removed; its readers use `--pie-background`.

## Compatibility

This PRD does not change PIE element tag names, model IDs, session IDs, persisted
session data, or player controller APIs.

Theming changes preserve:

- versioned `pie-*--version-*` tag names;
- contract attributes such as `id`, `model-id`, `session-id`, `slot`, `data-*`,
  `aria-*`, `pie-*`, `config-*`, and `context-*`;
- Host A's observed live CSS variable names, including broad semantic, border,
  button, section tab and card, and TTS highlight tokens, among them
  `--pie-button-background-color`;
- Host A's ability to win through unlayered cascade and `!important`, and its
  literal `dist/tokens.css`, `dist/color-schemes.css` and `dist/font-sizes.css`
  paths;
- the explicit `theme="light"` behavior Host V uses, and the light default
  Host A's theme setting relies on;
- root-entry self-registration, which Host A and other consumers import for its
  side effect, and the side-effect-free `theme-element` plus explicit
  `definePieTheme()` that Host V uses;
- light-DOM class and data hook behavior for custom elements whose markup is
  intentionally host-visible.

Raw built-in and base constants and one-off scheme helpers were removed without
aliases, and no other legacy path is kept for its own sake. The reference host
adapts to the package and does not narrow its design.

## Data Ownership And Host Responsibilities

PIE owns:

- canonical theme token documentation and registry enforcement;
- player/tool CSS variable fallback behavior;
- accessibility expectations for PIE-owned player and tool chrome;
- package-local tests, computed-style tests, and Playwright/a11y evidence for
  changed theming surfaces;
- release notes and changesets for public theming contract changes.

Hosts own:

- choosing theme values and ensuring their overrides maintain contrast;
- host page layout, landmarks, and global CSS outside PIE custom elements;
- product policy for theme selection, user preferences, persistence, and
  accommodation eligibility;
- reporting, gradebooks, workflow, and standards certification unless a concrete
  tested adapter PRD says otherwise.

## Serialization And Versioning

This PRD does not define persisted learner/session data or host-facing wire data.

The token registry is published package data. It follows the package version and
may add metadata fields; consumers ignore unknown fields. Scheme ids and token
names remain exact strings and are not normalized beyond trimming custom
registration input.

## Accessibility

Theming is accessibility-sensitive because color, focus, active and selected
states, and contrast directly affect assessment-taking UI.

Every change to a visible theming surface maps that surface into the
[theming WCAG matrix](../architecture/pie-727-theming-wcag-matrix.md), which
covers, when applicable:

- light DOM and shadow DOM surfaces;
- default, hover, focus-visible, active, selected, disabled, and open states;
- light, dark, `black-on-white`, `white-on-black`, and representative DaisyUI
  themes;
- default tokens and host-overridden variables;
- forced-colors mode without suppressing browser participation;
- WCAG 1.4.1, 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, and 2.5.8 where target
  size applies.

Automated checks prefer computed-style assertions for `color`,
`background-color`, `border-color`, `outline-color`, `box-shadow`, size, and
offset. Text contrast must meet at least `4.5:1`; UI, focus and non-text
contrast must meet at least `3:1`. Manual review is acceptable only where
automation cannot prove the requirement, and the matrix states the reason.

Built-in validation names semantic relationships explicitly instead of inferring
them from token names. Ordinary text relationships require `4.5:1`; focus,
control boundary, and other non-text relationships require `3:1`. Required
contrast-role values are opaque authored colors, with no unresolved `var()` or
transparency and no exceptions. The light base `--pie-background` is opaque
`#ffffff`: a transparent page token left the annotation underline and the
annotation toolbar boundary uncertifiable and invited components to read it as
an opaque fill. A host that wants its own surface to show through sets the token
itself. Component aliases may still reference canonical tokens.

The color-scheme tool (`theme`) exposes an unavailable requested scheme without
changing the learner's preference: a disabled option identifies the request, a
polite status states that PIE's base theme is active, and late registration
restores the normal option. Forced-colors coverage confirms the control remains
perceivable while the browser replaces colors; `forced-color-adjust: none` is
not used.

## Standards Or Adapter Impact

This PRD does not produce adapter-friendly data for QTI/PCI, LTI, xAPI, Caliper,
or SCORM, and it does not claim standards conformance.

The theming contract may be consumed by standards adapters indirectly through
PIE player custom elements, but adapter validation remains out of scope.

## Test Plan

Required test coverage:

- token registry contract tests for documented public tokens, undefined shared
  tokens, intentional legacy aliases, and component public hooks;
- `bun run check:theme-tokens` as the root gate linking registry entries to
  actual source usage, owner docs, canonical defaults, CSS defaults, and color
  scheme files;
- completeness and named semantic-contrast tests for every built-in palette;
- resolution tests for precedence, unavailable requests, removal/restoration,
  custom validation, immutable results, observation cardinality, listener
  isolation, and generation-aware receipts;
- generation and stale-output tests for both CSS adapters plus DaisyUI mapping
  parity;
- package-local style contract tests for every touched tool/player package;
- computed-style Playwright checks for changed visible player and tool chrome
  and for the stylesheet-only versus mounted CSS-only cascade boundary;
- forced-colors browser coverage for `<pie-theme>` and the color-scheme tool;
- axe or equivalent accessibility checks as supporting evidence, never as the
  only contrast or focus proof;
- CE/package boundary checks for custom-element and package-surface changes.

Commands:

```sh
bun test --dom packages/theme/tests
bun test packages/theme/tests/token-registry-contract.test.ts
bun test packages/assessment-toolkit/tests/highlight-coordinator-tts-style.test.ts
bun --cwd packages/theme run check:generated-css
bun run check:theme-tokens
bun run check:changeset-patch-only
```

For custom-element or export-boundary changes, also run:

```sh
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

For consumer or Playwright validation, rebuild touched packages first and run
outside the sandbox:

```sh
turbo build --filter=@pie-players/<pkg>...
export SECTION_DEMOS_PORT=$(bun ./scripts/get-free-port.mjs 5300)
bun run build:e2e:section-player
bunx playwright test packages/section-player/tests/section-theme-color-scheme.spec.ts packages/section-player/tests/section-toolbar-tools.spec.ts --config packages/section-player/playwright.config.ts
```

For final broad integration, run `bun run verify:local-pr` when Playwright
coverage is required.

## Rollout And Release Notes

- Changeset: a source or public-contract change to a publishable package
  carries one.
- Migration notes: Host A and Host V CSS and entrypoint dependencies remain
  supported. Runtime callers moved from raw palette arrays, constants and
  one-off helpers to snapshots, resolution, observation and registration
  receipts, with no aliases for unobserved interfaces.
- Documentation: the token registry, package READMEs for new component hooks,
  the WCAG matrix, and the theming docs.
- Release risk: medium to high for chrome changes, because contrast, focus, and
  selected and active-state regressions are user-visible and affect assessment
  accessibility.

## Open Questions

None.
