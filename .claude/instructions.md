# PIE Players - Project Instructions

## Project Context

**PIE Players** is a comprehensive web component framework for educational assessments. It provides multiple player strategies (IIFE, ESM, Preloaded, Section) and supports authoring mode, tools, and accommodations.

**Critical Requirements**:

- **WCAG 2.2 Level AA compliance**: Mandatory for all UI components
- **Bun runtime**: Node.js is NOT used - Bun version must match root `package.json` `packageManager` / `engines.bun`
- **Mixed shadow strategy**: This repo intentionally uses both `shadow: "open"` and `shadow: "none"` depending on integration/runtime needs
- **Svelte 5 with runes**: Modern reactive patterns required
- **ES2022 target**: Modern JavaScript required

## Technology Stack

- **Runtime**: Bun (version pinned in root `packageManager`; NOT Node.js for repo scripts)
- **UI Framework**: Svelte 5 with runes (compiled to web components)
- **Build**: Vite 7.0+ with Turbo for monorepo orchestration
- **Testing**: Bun:test (built-in) + Playwright for E2E
- **Accessibility**: @axe-core/playwright for automated accessibility testing
- **Type Checking**: TypeScript 5.9+ strict mode + svelte-check

## Monorepo Structure

```text
pie-players/
├── packages/                    # 20 packages
│   ├── pie-iife-player/        # IIFE bundle player (dynamic CDN loading)
│   ├── pie-esm-player/         # ESM CDN player (esm.sh, jsDelivr)
│   ├── pie-preloaded-player/ # Pre-bundled preloaded package output
│   ├── assessment-toolkit/     # Core assessment services (framework-agnostic)
│   ├── players-shared/         # Shared utilities & components
│   └── pie-tool-*/             # 10+ assessment tools (calculator, graph, etc.)
├── apps/
│   ├── docs/                   # Documentation site
│   ├── item-demos/             # Item demo host app
│   └── section-demos/          # Section demo host app
└── tools/cli/                  # oclif-based CLI
```

## Code Quality Standards

**After completing each feature or fix**:

1. Run Biome with auto-fix: `bun run lint:fix` or `npx @biomejs/biome check --write .`
2. Run TypeScript type checking: `bunx tsc --noEmit`
3. Run Svelte type checking: `bunx svelte-check --workspace packages/components`
4. Fix all errors and warnings before marking the task as complete

These checks ensure:

- Code follows project style standards
- No type errors are introduced
- Svelte components are valid and type-safe
- Changes don't break existing functionality

**Before any merge request**:

1. TypeScript compilation passes: `bun run typecheck`
2. Svelte components validated: `bun run check`
3. All tests pass: `bun test`
4. Linting clean: `bun run lint` (Biome)

## Ticket comment discipline

When posting to Jira, Confluence, or GitHub on the user's behalf, keep
comments **brief and scoped to the current work**. Summarize what landed
and, if relevant, the single action another team needs to take — nothing
more. Do not add sub-ticket asks, process recommendations, epic
restructuring suggestions, or unsolicited next-steps. If you think
something is worth raising, **ask the user first** rather than embedding
it in the comment. Honor removals: if the user removed a prior comment
and asks for a rewrite, do not reintroduce removed content.

Canonical rule: [`.cursor/rules/ticket-comment-discipline.mdc`](../.cursor/rules/ticket-comment-discipline.mdc).
Claude Code skill: [`.claude/skills/ticket-comment-discipline/SKILL.md`](./skills/ticket-comment-discipline/SKILL.md).

## Code review (multi-agent)

When the user asks for a **code review**, or after **substantial code changes** (multi-file features, cross-package work, non-trivial refactors, or anything suitable for a PR), run a structured review unless they opt out.

1. **Three independent reviewers**: Launch three separate review passes (e.g. sub-agents or reviewer skills) over the same change set without cross-sharing outputs; vary focus if useful (correctness/API vs UI/persistence vs tests/docs).
2. **Merge findings**: One coordinated summary—consensus, unique issues, de-duplicated.
3. **Plan**: Short actionable plan (ordered, with paths). Fix issues when implementation is in scope unless the user asked review-only.
4. **Disagreements**: If reviewers disagree and there is no clear technical or product rule to break the tie, **ask the user**—do not guess.

Cursor encodes the same expectations in `.cursor/rules/code-review-workflow.mdc` (`alwaysApply: true`).

## Testing Strategy

- **Unit tests**: Bun:test for logic and utilities
- **Component tests**: Test Svelte components with Bun's test runner
- **E2E tests**: Playwright for full user workflows
- **Accessibility tests**: Automated axe-core checks + manual verification
- **Evaluation tests**: Separate Playwright config for comprehensive validation

**Test files**: `*.test.ts` in `tests/` or package directories

### Build Before Tests (Required)

- Before running tests, rebuild the package(s) whose `src` files changed and any direct consumer packages that resolve those packages through `dist` exports.
- For custom-element package workflows, assume consumer apps use built `dist` outputs and rebuild affected packages first.
- If test failures might be caused by stale artifacts, rebuild and rerun once before deeper debugging.

### Playwright and `git push` must run outside the sandbox (Required)

The pre-push lefthook (see `lefthook.yml`) runs Playwright e2e suites
(`test:e2e:section-player:critical`, `test:e2e:item-player:multiple-choice`,
`test:e2e:assessment-player`). Playwright cannot install or launch Chromium
inside the default tool sandbox, so agents must invoke the following with
`required_permissions: ["all"]` so they execute outside the sandbox:

- `git push` (triggers the e2e pre-push hook).
- Any `bun run test:e2e:*` script or direct `bunx playwright …` invocation.
- `bun run test` / `bun test` in packages whose `tests/` directory contains
  Playwright `*.spec.ts` files.
- Any helper script (e.g. `verify-*.mjs`, ad-hoc DOM verification, screenshot
  capture) that imports `@playwright/test` or launches a browser.

Running inside the sandbox produces confusing failures such as
`browserType.launch: Executable doesn't exist at …/chrome-headless-shell-…`,
web-server start timeouts, or silent network blocks when Playwright tries to
download browser binaries. Running outside the sandbox reuses the shared
`~/Library/Caches/ms-playwright/` cache and the already-installed browser
version.

Canonical rule: [`.cursor/rules/playwright-sandbox.mdc`](../.cursor/rules/playwright-sandbox.mdc).

## Player Architecture

### Four Player Types

1. **IIFE Player** - Dynamic bundle loading from CDN (most flexible)
2. **ESM Player** - Native ES modules via CDN (modern browsers)
3. **Preloaded Strategy** - Pre-bundled with all elements (simplest deployment)

### Web Component Patterns

- **Mixed shadow mode**:
  - Prefer `shadow: "open"` for encapsulated tool/runtime components
  - Use `shadow: "none"` where host/page styles must cascade into rendered assessment content or layout wrappers
- **Custom elements**: Svelte compiled to native custom elements
- **Event-driven**: PIE player events for communication
- **Global registry**: Elements register in `window.pie.default`

### Custom Element Boundaries (Required)

- In consuming apps/packages, import CE registration entrypoints (for example `@pie-players/pie-assessment-toolkit/components/item-toolbar-element`), not raw package `.svelte` files.
- Do not import workspace package source paths (`@pie-players/<pkg>/src/...`) from consumers.
- Do not use `?customElement` in cross-package imports.
- Use `pie-*` class naming for component DOM hooks and CSS selectors (for example `pie-section-player-*`, `pie-tool-*`) instead of generic names like `header`, `content`, `container`, `card`, `pane`, `toolbar`, `body`, or `active`.
- For light-DOM custom elements (`shadow: "none"`), treat class names as public integration surface: prefer stable `pie-*` or `data-pie-*` hooks and avoid unscoped/global utility class dependencies.
- Keep package `exports` runtime targets on built artifacts in `dist` (not `src`), except for explicitly approved internal packages.
- When adding a CE registration entry in a package, ensure any referenced `.svelte?customElement` files are resolvable from published output.
- If a consumer app imports package CE entrypoints via `exports` (for example `@pie-players/pie-section-player/components/...`), it is using built `dist` artifacts. Rebuild the package after `src` edits before testing behavior in the consumer app.
- For split-panel scrolling implementations, copy the current `packages/section-player/src/components/layouts/SplitPanelLayout.svelte` overflow/height model unless intentionally redesigning:
  - Constrain parent containers with `height: 100%`, `max-height: 100%`, `min-height: 0`, and `overflow: hidden`.
  - Keep split grid height-constrained (including `grid-template-rows: minmax(0, 1fr)` when applicable).
  - Configure pane scrolling with `overflow-y: auto`, `overflow-x: hidden`, `min-height: 0`, `min-width: 0`, `max-height: 100%`, and `overscroll-behavior: contain`.
  - Do not introduce broad media-query overrides that force pane overflow to `visible` without explicit verification of both passage and item scroll behavior.
- Before finalizing CE-related changes, run:
  - `bun run check:source-exports`
  - `bun run check:consumer-boundaries`
  - `bun run check:custom-elements`

### Web Components and Reactivity

- Treat custom elements as imperative APIs: set properties, not attributes.
- Do not assume attribute updates are reactive for object data.
- For model/session updates, reassign new objects when needed to trigger updates.
- When using controller-based elements, rebuild and re-set the element model on mode/session changes.

### Svelte Effect and Subscription Safety

- Keep `$effect` bodies focused on wiring (subscribe/unsubscribe, setup/teardown), not UI state mutation.
- If setup logic must read/write reactive state (for example seeding debugger rows), run setup inside `untrack(() => { ... })` to avoid accidental effect dependencies.
- Make subscriptions idempotent: if the target (`sectionId` + `attemptId`) is unchanged and a subscription exists, return early.
- Prefer stable key checks (`sectionId`, `attemptId`) over controller object identity for resubscribe decisions.
- For lifecycle-driven resubscribe, queue work with `queueMicrotask` to avoid synchronous re-entrant update chains.
- On lifecycle `"disposed"` events, detach the current subscription before queueing a rebind.

### Debugger Panel Contract

- Debugger panels are consumers, not state owners: they should render controller state reads (`getRuntimeState` / `getSession`) plus forward controller events.
- Do not rely on event replay for baseline panel state; use explicit state reads for initialization.

### Theming Contract (Shadow-Safe)

- Use `--pie-*` CSS variables as the stable theming contract across both `shadow: "open"` and `shadow: "none"` CEs.
- Keep canonical defaults/schemes in `@pie-players/pie-theme`; consumer tools/components should use exported scheme APIs (for example `listPieColorSchemes`) instead of duplicating catalogs.
- Preserve theme merge order: base theme (`light`/`dark`/`auto`) -> provider variables -> color-scheme variables -> explicit overrides.
- Prefer token-driven styles for interactive states (`hover`, `active`, `focus`) using `--pie-button-*` and `--pie-focus-*`; avoid hardcoded color literals in component styles.
- For shadow components, treat internal selectors as private and expose only documented host-level customization hooks (tokens and explicit parts/attributes where required).
- Validate theme switching with runtime tests that assert existing light+shadow nodes update without remount.

### DOM Usage Rules

- Scope DOM listeners to the nearest host/container element; avoid `document`/`window` listeners for internal coordination unless no scoped alternative exists.
- Always clean up listeners, observers, and timers in effect teardown.
- Treat DOM events as boundary signals, not primary internal state storage.
- Use controller/context values as source of truth and derive DOM from state.
- Use typed/documented `CustomEvent` payloads; prefer `bubbles: true` and `composed: true` for host-boundary events.
- In light-DOM custom elements, prefer stable `pie-*` or `data-pie-*` selectors; avoid fragile generic class hooks.
- Prefer host-scoped queries over broad document-wide queries.
- When normalizing low-level player events into canonical runtime events, add dedupe/intent guards.

### Demo UI Preferences

- **Prefer simplicity**: Use URL parameters with page refresh over complicated reactive component tracking for demo toggles (player type, layout, mode/role)
- **Why**: Mode and role switches are primarily for demos - in production environments, these are typically fixed
- **Pattern**: Read from URL params on page load (`?player=iife&layout=split-panel&mode=scorer`), refresh page when changed
- **Avoid**: Complex reactive effects, router state management, or `{#key}` blocks for simple demo switches

### Element API

Each element exports three entry points:

- `element.js` - Custom element wrapper
- `controller.js` - Server/client-side logic
- `author.js` - Configuration UI

## Build System

- **Turbo**: Orchestrates builds with dependency ordering and caching
- **Vite**: Bundles each package
  - Inline dynamic imports for players (single bundle)
  - Type definitions via vite-plugin-dts
- **Build outputs**: ESM format, source maps, declaration maps

**Build commands**:

```bash
bun run build          # Build all packages (Turbo orchestrated)
bun run dev            # Watch mode for development
bun run typecheck      # TypeScript validation
bun run check          # Svelte component validation
```

## Special Patterns

### Accessibility First

- WCAG 2.2 Level AA is mandatory, not optional
- Focus management and keyboard navigation required
- Axe-core integration in Playwright tests
- Multiple assessment accommodations (tools for special needs)

### Authoring Mode

- Items can be configured/edited live
- Dual mode: authoring + student interaction
- Configuration UI in separate entry point (`author.js`)

### Model-Driven Architecture

- Configuration/markup/models separation
- PIE controller pattern: `model()`, `outcome()`, `validate()`, `createDefaultModel()`
- Session management for attempt tracking

### Tool Coordination

- Centralized event bus for tool communication
- Tools work across different player implementations
- 10+ tools: calculator, graph, ruler, protractor, periodic table, TTS, annotation, etc.

## Publishing & Versioning

- **Changesets**: Version management (`@changesets/cli`)
- **MIT license**: All packages public
- **npm publishing**: Public access
- **Local packaging**: `pack:local` for offline builds

### Fixed (lockstep) versioning policy (required)

All publishable `@pie-players/*` packages are released with a **fixed
(lockstep) version**. At any published version, every package in the suite
carries the same version number. This is enforced by Changesets' `fixed`
block in `.changeset/config.json` and validated by
`scripts/check-fixed-versioning.mjs` (run via `bun run verify:publish`).

**Why**: the publishable packages form a single cohesive player framework
(players, tools, TTS servers, theming, toolkits) with internal contracts
that cross package boundaries. Consumers adopt the suite as a unit, so
lockstep removes a class of compatibility bugs and eliminates any
`@pie-players/*` cross-version matrix.

**Implications for agent-driven work**:

- Always include **all** publishable packages in release/versioning steps.
  Never scope a release bump to "only the packages I changed."
- Every release bumps every publishable package, including ones whose
  source did not change. That is expected, not a bug. Do not try to skip
  unchanged packages.
- A breaking change in one publishable package forces a major bump across
  the entire suite. Factor that in when scoping breaking changes; prefer
  additive changes where feasible.
- When adding a new publishable package under `packages/*`, add it to the
  `fixed` block in `.changeset/config.json` in the same change set.
- Do not remove packages from the `fixed` block to "unblock" a release.
  That hides drift instead of fixing it. Escalate to the maintainer.

Consumer-facing docs: [`../docs/setup/publishing.md`](../docs/setup/publishing.md)
and the "Versioning Policy" section in [`../README.md`](../README.md).
Canonical rule: [`../.cursor/rules/release-version-alignment.mdc`](../.cursor/rules/release-version-alignment.mdc).

## Sibling Repository Dependency

**CRITICAL**: This project relies on `pie-elements-ng` being checked out as a sibling directory for local development and testing.

**Expected structure**:

```text
<parent-directory>/
├── pie-elements-ng/          # Sibling repo (REQUIRED for dev)
│   └── apps/local-esm-cdn/   # Local ESM CDN server
└── pie-players/              # This repo
    └── apps/section-demos/   # Demo app can auto-detect sibling
```

**Auto-detection**: When `../pie-elements-ng` exists:

- Vite plugin automatically loads from `pie-elements-ng/apps/local-esm-cdn/dist/adapters/vite.js`
- Local ESM CDN server can be started with `bun run local-esm-cdn`
- HMR automatically triggers on pie-elements-ng dist file changes

**Graceful degradation**: If sibling repo not found:

- Console logs: "[local-esm-cdn] Sibling pie-elements-ng not found, skipping plugin"
- Falls back to remote esm.sh CDN
- Project still functions, but can't test with local elements

**Why this matters**:

- Enables testing ESM player with local pie-elements without publishing to npm
- Critical for developing new element types or fixing element bugs
- Allows tight integration testing between players and elements

**References**: apps/section-demos/vite.config.ts, docs/cdn_usage.md

## Current Work Focus

The project is a production-grade framework with comprehensive accessibility support and multiple deployment options. Focus on maintaining WCAG 2.2 Level AA compliance and ensuring all players work consistently across deployment modes.
