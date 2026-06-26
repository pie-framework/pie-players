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

A Quiz Engine styling regression exposed that PIE Players hosts can accidentally
override broad semantic theme tokens, such as `--pie-primary`, to style one
local control state and unintentionally break unrelated selected, active, or
focused UI. The narrow PIE-727 fix adds component-scoped active/open trigger
hooks for inline TTS and calculator tools, but the broader repo still has
multiple theming sources of truth, undocumented `--pie-*` token usage, hardcoded
colors, and partial WCAG validation for theme-sensitive chrome.

PIE Players needs a durable theming contract so hosts can theme player and tool
surfaces ergonomically without relying on broad-token overrides that can affect
assessment-taking UI in surprising ways.

## Goals

- Define a machine-checkable `--pie-*` token contract for canonical semantic
  tokens, component-scoped public hooks, package-private fallbacks, legacy
  tokens, and intentionally unsupported gaps.
- Establish a source-of-truth decision for theme defaults, color schemes, CSS
  token files, DaisyUI mappings, and legacy theme paths before broad UI changes.
- Require a checked-in WCAG/computed-style coverage matrix for every touched
  visible theming surface.
- Preserve existing documented and de facto host overrides unless a reviewed
  decision record accepts a breaking contract change.
- Treat existing public `--pie-*` tokens as host compatibility contracts. QE
  already depends on current broad token names such as `--pie-primary`,
  `--pie-background`, `--pie-button-bg`, and `--pie-button-color`; broad theming
  work must preserve those names and fallback behavior.
- Require new theming hooks and style changes to follow established local
  patterns first: existing semantic tokens, existing button token chains,
  package-local README documentation, package-local style-contract tests, and
  additive fallback behavior. New naming patterns need a decision record.
- Split broad theming implementation into independently reviewable slices with
  package-local tests, documentation, rebuilds, and patch changesets.
- Keep WCAG 2.2 Level AA expectations explicit for text contrast, non-text
  contrast, focus visibility, keyboard access, high contrast, zoom, and target
  size where applicable.

## Non-Goals

- No replacement of DaisyUI or redesign of every theme name.
- No QE-specific selectors or host-specific fixes in PIE Players.
- No change to the broad semantic meaning of `--pie-primary`,
  `--pie-background`, `--pie-text`, or feedback tokens to satisfy one local
  control state.
- No sweeping rename, removal, or collapse of existing public `--pie-*` tokens.
  Add safer component-scoped hooks and preserve existing fallback chains instead.
- No broad compatibility shim layer for legacy internal APIs.
- No claim of WCAG certification or assistive technology support beyond the
  scoped test/manual evidence produced by implementation slices.
- No persisted model, session, assessment, scoring, or standards-adapter schema
  changes.

## Package And Export Ownership

- Owning package: `@pie-players/pie-theme` owns the canonical token registry and
  semantic token contract.
- Public export path: no new JavaScript export is required by this PRD. The
  host-facing contract is CSS custom properties documented through package docs
  and a checked-in token registry, proposed as
  `packages/theme/src/token-registry.json`.
- Consuming packages or apps: `@pie-players/pie-section-player`,
  `@pie-players/pie-assessment-player`,
  `@pie-players/pie-assessment-toolkit`, `@pie-players/pie-tool-*`,
  `@pie-players/pie-section-player-tools-*`, demo apps, and external hosts such
  as Quiz Engine.
- Runtime environment: browser custom elements and Svelte components compiled as
  custom elements. Some surfaces use shadow DOM and some intentionally use light
  DOM.

Component-scoped public hooks remain owned by their component package but must be
listed in the `@pie-players/pie-theme` token registry so hosts can discover the
full public theming contract in one place.

## Contract Shape

This PRD defines a theming contract rather than a runtime TypeScript API.

The implementation should add a token registry with entries shaped like:

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
  definedIn: string[];
  documentedIn: string[];
  fallbackPolicy: string;
}
```

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

Required decision records before broad UI implementation:

- canonical source of truth for base tokens and color schemes;
- public token registry shape and allowed classifications;
- host compatibility baseline for documented and de facto token consumers,
  including QE;
- established local pattern check: before introducing a new token family,
  confirm that an existing semantic token, button token, or component-scoped
  hook pattern cannot satisfy the use case safely;
- focus token ownership;
- relationship between `ThemeProvider`, `pie-theme`, DaisyUI provider mappings,
  and CSS `data-color-scheme` fallback;
- light-DOM compatibility inventory for every touched component.

Known naming and fallback issues to resolve additively:

- `packages/tool-tts-inline/tool-tts-inline.svelte` used
  `--pie-button-background-color`, `--pie-button-border-color`, and
  `--pie-button-hover-background-color`. These names must keep working, but the
  implementation should route them through established `--pie-button-bg`,
  `--pie-button-border`, and `--pie-button-hover-bg` fallbacks. The initial
  broad slice adds those fallback chains and registry entries.
- `packages/assessment-player/src/components/AssessmentPlayerDefaultElement.ts`
  used undefined `--pie-background-light`. Preserve the name if hosts
  rely on it, but add a `--pie-background` fallback or classify/promote it by
  decision record. The initial broad slice keeps the alias unsupported and adds
  the `--pie-background` fallback.
- `packages/theme/src/components.css` used
  `--pie-focus-ring-color`. Align it through `--pie-focus-outline` and
  `--pie-button-focus-outline` instead of adding another unrelated focus token.
  The initial broad slice classifies it as a legacy alias.
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
- existing documented host CSS variable overrides unless a decision record
  accepts a breaking contract change;
- existing public `--pie-*` token names and fallback behavior, especially broad
  semantic and button tokens known to be consumed by QE and other hosts;
- light-DOM class and data hook behavior for custom elements whose markup is
  intentionally host-visible.

New public CSS variables must be additive by default. They should preserve
existing visual behavior through fallback chains that continue through existing
semantic or button tokens unless the PRD decision record explicitly documents a
breaking change.

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

The proposed token registry is source documentation and test input. If a future
implementation publishes the registry as a runtime import or generated artifact,
that PR must define unknown-field behavior, versioning, and package export
ownership separately.

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
- WCAG 1.4.1, 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13, and 2.5.8 where target
  size applies.

Automated checks should prefer computed-style assertions for `color`,
`background-color`, `border-color`, `outline-color`, `box-shadow`, size, and
offset. Text contrast must meet at least `4.5:1`; UI/focus/non-text contrast
must meet at least `3:1`. Manual review is acceptable only where automation
cannot prove the requirement, and the matrix must state the reason.

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
- parity tests for the chosen token source of truth, CSS token files, color
  schemes, and DaisyUI mappings;
- package-local style contract tests for every touched tool/player package;
- computed-style Playwright checks for visible player/tool chrome changed by an
  implementation slice;
- axe or equivalent accessibility checks as supporting evidence, not as the only
  contrast/focus proof;
- CE/package boundary checks for custom-element and package-surface changes.

Commands:

```sh
bun test packages/theme/src/theme-element.test.ts
bun test packages/theme-daisyui/tests/mapping-parity.test.mjs
bun test packages/theme/tests/token-registry-contract.test.ts
bun test packages/assessment-toolkit/tests/highlight-coordinator-tts-style.test.ts
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
- Migration notes: public CSS variable changes should be additive. Existing
  public token names remain supported; ambiguous or unsafe tokens should be
  classified as `legacy`, `unsupported`, or `intentional-gap` before any
  replacement is introduced. Breaking changes to documented or de facto host
  overrides require a separate migration plan, host impact review, and explicit
  release notes.
- Documentation updates: token registry, package READMEs for new component hooks,
  WCAG matrix, and any updated theme architecture docs.
- Release risk: medium to high for source-changing slices because contrast,
  focus, and selected/active-state regressions are user-visible and can affect
  assessment accessibility.

Implementation should roll out in small slices:

1. audit/spec and token registry;
2. theme contract tests;
3. shared theme/focus tokens;
4. player chrome surfaces split by ownership boundary;
5. inline tool remaining local states;
6. floating tool groups;
7. legacy theme provider and DaisyUI bridge alignment.

## Open Questions

- Should `packages/theme/src/theme-defaults.ts` and `color-schemes.ts` become
  the canonical token source, with CSS files generated or parity-tested?
- Should `--pie-focus-outline` become canonical, alias an existing token, or
  remain component-scoped?
- Should the registry command be a root script such as
  `bun run check:theme-tokens`, or remain a package-level Bun test?
- Which `data-color-scheme` fallback behavior remains supported after
  `pie-theme` and `tool-color-scheme` are aligned?
- Which representative DaisyUI themes are mandatory in the WCAG matrix?
