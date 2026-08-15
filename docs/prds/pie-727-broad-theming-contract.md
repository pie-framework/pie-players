# PIE-727 Broad Theming Contract

Status: Ready

Owner: PIE Players maintainers

Related architecture:

- [Developer patterns](../architecture/developer_patterns.md)
- [Accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md)
- [Section player client architecture tutorial](../section-player/client-architecture-tutorial.md)
- [PIE-727 theme token inventory](../architecture/pie-727-theme-token-inventory.md)
- [PIE-727 theming implementation slices](../architecture/pie-727-theming-implementation-slices.md)
- [PIE-727 theming WCAG matrix](../architecture/pie-727-theming-wcag-matrix.md)

## Problem

A host styling regression exposed that PIE Players hosts can accidentally
override broad semantic theme tokens, such as `--pie-primary`, to style one
local control state and unintentionally break unrelated selected, active, or
focused UI. The narrow PIE-727 fix adds component-scoped active/open trigger
hooks for inline TTS and calculator tools, but the broader repo still has
separate TypeScript and CSS palette sources, no observable custom-scheme
catalog, and partial WCAG validation for theme-sensitive chrome.

PIE Players needs a durable theming contract so hosts can theme player and tool
surfaces ergonomically without relying on broad-token overrides that can affect
assessment-taking UI in surprising ways.

## Goals

- Define a machine-checkable `--pie-*` token contract for canonical semantic
  tokens, component-scoped public hooks, package-private fallbacks, legacy
  tokens, and intentionally unsupported gaps.
- Make one side-effect-free TypeScript definition the source of truth for base
  themes and complete built-in color schemes.
- Publish a small operational interface for resolving themes and observing or
  registering custom schemes without publishing raw palette tables.
- Keep requested and resolved scheme state distinct so an unavailable
  preference survives removal and late registration.
- Generate the checked-in `tokens.css` and `color-schemes.css` adapters from the
  canonical definition and reject stale output without rewriting it in builds.
- Require a checked-in WCAG/computed-style coverage matrix for every touched
  visible theming surface.
- Preserve the client-facing Host A and Host V surfaces recorded in the
  consumer-dependency pad: live token names and override leverage, literal CSS
  artifact paths, explicit-light behavior, and theme entrypoint side effects.
- Require new theming hooks and style changes to follow established local
  patterns first: existing semantic tokens, existing button token chains,
  package-local README documentation, package-local style-contract tests, and
  additive fallback behavior. New naming patterns need a decision record.
- Land the canonical definition, runtime, generated adapters, and picker as one
  coordinated slice; keep later player/tool chrome changes independently
  reviewable with package-local tests, documentation, rebuilds, and patch
  changesets.
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
  scoped test/manual evidence produced by implementation slices.
- No persisted model, session, assessment, scoring, or standards-adapter schema
  changes.

## Package And Export Ownership

- Owning package: `@pie-players/pie-theme` owns the canonical token registry and
  semantic token contract.
- Public export path: `@pie-players/pie-theme` owns the operational TypeScript
  interface and token-registry types; `@pie-players/pie-theme/token-registry.json`
  publishes the registry; the existing CSS subpaths remain output adapters.
- Consuming packages or apps: `@pie-players/pie-section-player`,
  `@pie-players/pie-assessment-player`,
  `@pie-players/pie-assessment-toolkit`, `@pie-players/pie-tool-*`,
  `@pie-players/pie-section-player-tools-*`, demo apps, and external hosts
  through their package and custom-element interfaces.
- Runtime environment: browser custom elements and Svelte components compiled as
  custom elements. Some surfaces use shadow DOM and some intentionally use light
  DOM.

Component-scoped public hooks remain owned by their component package but must be
listed in the `@pie-players/pie-theme` token registry so hosts can discover the
full public theming contract in one place.

## Contract Shape

The root entrypoint exports this operational interface:

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
  diagnostics: readonly PieThemeDiagnostic[];
}

interface PieThemeDiagnostic {
  code: string;
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
  variables: Record<string, string | number>;
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
  name: `--pie-${string}`;
  owner: `@pie-players/${string}`;
  scope:
    | "canonical-semantic"
    | "component-public"
    | "package-private"
    | "legacy"
    | "unsupported";
  category: string;
  status: "active" | "deprecated" | "planned" | "intentional-gap";
  schemeParticipation: "required" | "optional" | "excluded";
  definedIn: string[];
  documentedIn: string[];
  fallbackPolicy: string;
}
```

Every active canonical color token participates in a built-in scheme and is
`required`; typography, private, legacy, unsupported, and inactive tokens are
`excluded`. Component-public tokens are `optional` unless their ordinary
fallback cannot satisfy accessibility. The annotation toolbar outline and both
annotation underline tokens are therefore `required`.

Built-in color schemes are complete accessibility palettes. Registered custom
schemes are partial overlays and may contain only required or optional
participating tokens. Built-in ids and `default` are reserved. Unknown,
excluded, private, and legacy token names reject the whole custom entry.
Contrast diagnostics are computed from affected semantic relationships in the
fully resolved custom palette. They are warnings rather than registration
blockers because the host owns that palette; built-in palettes must pass the
same named relationships in tests.

`default` is the first catalog descriptor but is not another palette. It means
no named scheme. An unknown requested id yields `status: "unavailable"`, keeps
the request and `data-color-scheme`, resolves no managed scheme, and renders the
base/provider result with explicit variables still applied last. Late
registration or re-registration resolves it automatically.

Keeping `data-color-scheme` is a selector hook, not another managed precedence
layer. A CSS-only scheme participates in the normal cascade when the generated
stylesheets are used without a mounted `<pie-theme>`. A selector competing with
a mounted element's inline resolved tokens must use `!important`; schemes that
need normal managed precedence register through `registerPieColorSchemes()`.

Resolution order is base theme, provider variables, resolved scheme, then
explicit variables. A built-in overrides every required participating provider
value; optional component hooks continue to inherit when the built-in does not
define them. An explicit variable remains final. Catalog previews resolve a
scheme over PIE's canonical light Base Theme, then project background, text,
and primary onto a stable opaque swatch. Projection retains only a deterministic
opaque subset: named colors, three- or six-digit hex, non-alpha `rgb()`,
`hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, and standard CSS
Color 4 `color()` spaces. Transparent, explicit-alpha, relative, nested,
context-dependent, malformed, or unsupported projected forms use canonical
preview fallbacks without changing the authored theme variables. Previews are
never authored metadata and do not claim to mirror a host-specific provider.

The package-internal `renderPieThemeCss()` returns the `tokens.css` and
`color-schemes.css` strings from the same definitions. The package command
`generate:css` invokes `packages/theme/scripts/generate-theme-css.ts --write`;
`check:generated-css` invokes its non-mutating `--check` mode. The root
`bun run check:theme-tokens` gate also stale-checks both files. Package builds
check before copying to `dist` and never rewrite tracked source.

Generated `color-schemes.css` contains exactly one unlayered
`[data-color-scheme="..."]` rule per built-in. It contains no `:root`, dark-theme,
or grouped exception rules. DaisyUI remains a Theme Provider adapter because it
resolves host state rather than defining a built-in palette.

Examples:

- `--pie-primary` is a canonical semantic token. It represents an interactive
  brand/action color and must not be repurposed as a local button background by
  hosts or component internals. It also must not be renamed or removed in this
  broad pass because hosts already consume it.
- `--pie-tool-trigger-active-background` is a component-scoped public hook. It
  lets hosts style a local active/open trigger state without changing broad
  semantic colors. New component-scoped hooks should follow this established
  pattern: precise component/state naming, broad-token fallbacks, README
  documentation, registry entry, and focused style-contract tests.
- `--pie-focus-outline`, `--pie-background-light`, and similar recurring or
  undefined tokens must be classified before source-changing work starts.

The source-of-truth, participation, provider, generated-CSS, requested/resolved,
and external-host decisions above supersede the earlier open design questions.
Before introducing a new token family, an implementation slice must still
confirm that an existing semantic token, button token, or component-scoped hook
cannot satisfy the use case safely.

Previously classified naming and fallback paths:

- `packages/tool-tts-inline/tool-tts-inline.svelte` used
  `--pie-button-background-color`, `--pie-button-border-color`, and
  `--pie-button-hover-background-color`. An earlier slice routed them through
  established `--pie-button-bg`, `--pie-button-border`, and
  `--pie-button-hover-bg` fallbacks. Only
  `--pie-button-background-color` is recorded as an external Host A dependency;
  the other historical names do not justify additional compatibility paths.
- `packages/assessment-player/src/components/AssessmentPlayerDefaultElement.ts`
  used undefined `--pie-background-light`. The earlier slice classified it as
  unsupported and added the `--pie-background` fallback. No observed external
  dependency makes the unsupported name a compatibility requirement.
- `packages/theme/src/components.css` used
  `--pie-focus-ring-color`. Align it through `--pie-focus-outline` and
  `--pie-button-focus-outline` instead of adding another unrelated focus token.
  The earlier slice classified it as a legacy alias; it is not an observed
  external-host requirement and does not participate in schemes.
- `packages/section-player/README.md` documented tab tokens that did not
  exactly match `SectionPlayerTabbedContent.svelte`. Resolve this as a
  docs/code compatibility issue with aliases or corrected documentation, not as a
  silent rename. The initial broad slice corrects the docs to the implemented
  component-public tab hooks and registers those hooks.

## Compatibility

This PRD does not change PIE element tag names, model IDs, session IDs, persisted
session data, or player controller APIs.

Implementation slices must preserve:

- versioned `pie-*--version-*` tag names;
- contract attributes such as `id`, `model-id`, `session-id`, `slot`, `data-*`,
  `aria-*`, `pie-*`, `config-*`, and `context-*`;
- Host A's observed live CSS variable names, including broad semantic, border,
  button, section tab/card, and TTS highlight tokens (including the observed
  `--pie-button-background-color` alias);
- Host A's ability to win through unlayered cascade and `!important` and its
  literal `dist/tokens.css`, `dist/color-schemes.css`,
  `dist/font-sizes.css`, and `dist/components.css` paths;
- explicit `theme="light"` behavior used by Hosts A and V;
- root-entry self-registration used by Host A and side-effect-free
  `theme-element` plus explicit `definePieTheme()` used by Host V;
- light-DOM class and data hook behavior for custom elements whose markup is
  intentionally host-visible.

No other legacy path is retained merely because it existed. Raw built-in/base
constants and one-off scheme helpers are removed rather than aliased. The
internally controlled reference host is fixed when available and does not narrow
the package design.

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

The token registry is published package data, not persisted learner/session or
host-facing wire data. It follows the package version and may add metadata fields;
consumers should ignore unknown fields. Scheme ids and token names remain exact
strings and are not normalized beyond trimming custom registration input.

All publishable package changes must follow fixed lockstep release policy. Source
or public-contract changes need patch changesets for the publishable packages
whose source/contracts changed; the release process still bumps all publishable
`@pie-players/*` packages together.

## Accessibility

The broad theming pass is accessibility-sensitive because color, focus, active
states, selected states, and contrast directly affect assessment-taking UI.

Every source-changing implementation slice must map touched visible surfaces to
a checked-in WCAG/computed-style matrix, proposed as
`docs/architecture/pie-727-theming-wcag-matrix.md`.

The matrix must cover, when applicable:

- light DOM and shadow DOM surfaces;
- default, hover, focus-visible, active, selected, disabled, and open states;
- light, dark, `black-on-white`, `white-on-black`, and representative DaisyUI
  themes;
- default tokens and host-overridden variables;
- forced-colors mode without suppressing browser participation;
- WCAG 1.4.1, 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, and 2.5.8 where target
  size applies.

Automated checks should prefer computed-style assertions for `color`,
`background-color`, `border-color`, `outline-color`, `box-shadow`, size, and
offset. Text contrast must meet at least `4.5:1`; UI/focus/non-text contrast
must meet at least `3:1`. Manual review is acceptable only where automation
cannot prove the requirement, and the matrix must state the reason.

Built-in validation names semantic relationships explicitly instead of inferring
them from token names. Ordinary text relationships require `4.5:1`; focus,
control boundary, and other non-text relationships require `3:1`. Required
contrast-role values are opaque authored colors rather than unresolved `var()`
or transparency, except the externally observed transparent light base
`--pie-background`. Component aliases may still reference canonical tokens.

The theme picker must expose an unavailable requested scheme without silently
changing the learner's preference: a disabled unavailable option identifies the
request, a programmatic status states that the base theme is active, and late
registration restores the normal option. Forced-colors coverage confirms the
control remains perceivable while allowing the browser to replace colors; do not
add `forced-color-adjust: none`.

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
- computed-style Playwright checks for visible player/tool chrome changed by an
  implementation slice and for the stylesheet-only versus mounted CSS-only
  cascade boundary;
- forced-colors browser coverage for `<pie-theme>` and the theme picker;
- axe or equivalent accessibility checks as supporting evidence, not as the only
  contrast/focus proof;
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

- Changeset required: no for docs-only PRD/audit/spec changes; yes for source or
  public-contract changes in publishable packages.
- Migration notes: client-facing Host A/V CSS and entrypoint dependencies remain
  supported. Runtime callers migrate from raw palette arrays/constants and
  one-off helpers to snapshots, resolution, observation, and registration
  receipts. No legacy aliases are added for unobserved interfaces.
- Documentation updates: token registry, package READMEs for new component hooks,
  WCAG matrix, and any updated theme architecture docs.
- Release risk: medium to high for source-changing slices because contrast,
  focus, and selected/active-state regressions are user-visible and can affect
  assessment accessibility.

The canonical definition, operational runtime, custom element, picker, generated
CSS, tests, documentation, and patch changesets land as one coordinated theme
release slice. Internally controlled consumers are updated with that slice when
their checkout is available.

## Open Questions

None for this implementation slice.
