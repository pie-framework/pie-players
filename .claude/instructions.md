# PIE Players - Project Instructions

## Project Context

**PIE Players** is a comprehensive web component framework for educational assessments. It provides multiple player implementations (IIFE, ESM, Fixed, Inline, Section) and supports authoring mode, tools, and accommodations.

**Critical Requirements**:

- **WCAG 2.2 Level AA compliance**: Mandatory for all UI components
- **Bun runtime**: Node.js is NOT used - Bun 1.3.5+ required
- **No shadow DOM**: Web components use Svelte compiled to custom elements without shadow DOM for better host page integration
- **Svelte 5 with runes**: Modern reactive patterns required
- **ES2022 target**: Modern JavaScript required

## Technology Stack

- **Runtime**: Bun 1.3.5+ (NOT Node.js)
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
│   ├── pie-fixed-player/       # Pre-bundled monolithic player
│   ├── pie-inline-player/      # Embedded player for existing systems
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

## Testing Strategy

- **Unit tests**: Bun:test for logic and utilities
- **Component tests**: Test Svelte components with Bun's test runner
- **E2E tests**: Playwright for full user workflows
- **Accessibility tests**: Automated axe-core checks + manual verification
- **Evaluation tests**: Separate Playwright config for comprehensive validation

**Test files**: `*.test.ts` in `tests/` or package directories

## Player Architecture

### Four Player Types

1. **IIFE Player** - Dynamic bundle loading from CDN (most flexible)
2. **ESM Player** - Native ES modules via CDN (modern browsers)
3. **Fixed Player** - Pre-bundled with all elements (simplest deployment)
4. **Inline Player** - Embedded in existing systems (tight integration)

### Web Component Patterns

- **No shadow DOM**: Better CSS integration with host pages
- **Custom elements**: Svelte compiled to native custom elements
- **Event-driven**: PIE player events for communication
- **Global registry**: Elements register in `window.pie.default`

### Custom Element Boundaries (Required)

- In consuming apps/packages, import CE registration entrypoints (for example `@pie-players/pie-assessment-toolkit/components/item-toolbar-element`), not raw package `.svelte` files.
- Do not import workspace package source paths (`@pie-players/<pkg>/src/...`) from consumers.
- Do not use `?customElement` in cross-package imports.
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

**References**: apps/section-demos/vite.config.ts, docs/CDN_USAGE.md

## Current Work Focus

The project is a production-grade framework with comprehensive accessibility support and multiple deployment options. Focus on maintaining WCAG 2.2 Level AA compliance and ensuring all players work consistently across deployment modes.
