# pie-players

Modern PIE (Platform for Interactive Education) player implementations built with Bun + TypeScript + Svelte 5.

## Sites

- **Docs (front)**: `https://pie-framework.github.io/pie-players/`
- **Examples (sub-site)**: `https://pie-framework.github.io/pie-players/examples/`

## Features

- 🎯 **Multiple Player Types**: IIFE, ESM, Fixed, and Inline players
- ✏️ **Authoring Mode**: Built-in support for editing PIE items with configure elements
- 🎨 **Preview Toggle**: Switch between authoring and student view
- 📦 **Bundle Types**: Support for player.js, client-player.js, and editor.js bundles
- 🔧 **Assessment Toolkit**: Reference implementation for assessment-level features
- ♿ **Accessibility**: A11y testing components and focus management
- 🎭 **Multiple Themes**: Example app with theme switching (light, dark, cupcake, cyberpunk)

## Packages

### Players

- **pie-iife-player** - Loads PIE elements dynamically from IIFE bundles
- **pie-esm-player** - Loads PIE elements from ESM CDN (esm.sh, jsDelivr)
- **pie-fixed-player** - Pre-bundled player for fixed layouts
- **pie-inline-player** - Inline player for embedded contexts

### Shared

- **players-shared** - Shared components, utilities, and types
- **assessment-toolkit** - Reference implementation for assessment features

### Tools

- **pie-tool-calculator** - Calculator tool component
- **pie-tool-graph** - Graphing tool component
- **pie-tool-ruler** - Digital ruler tool
- **pie-tool-protractor** - Protractor tool
- **pie-tool-magnifier** - Magnification tool
- **pie-tool-annotation-toolbar** - Annotation toolbar
- **pie-tool-color-scheme** - Color scheme tool
- **pie-tool-periodic-table** - Periodic table reference

### Assessment

- **pie-assessment-player** - Complete assessment player

### Example

- **example** - Demo application showcasing all features

## Quick Start

```bash
# Install dependencies
bun install

# Run docs (front site)
bun run dev:docs

# Run examples app (includes authoring + assessment demos)
bun run dev:example

# Visit the printed dev server URL(s)
```

## Development

### Recommended (monorepo) dev workflow

Run the whole workspace in watch mode so package `dist/` outputs update automatically:

```bash
bun dev
```

If you're only working on the example app but still want workspace deps to rebuild/watch:

```bash
bun run --cwd apps/example dev:with-deps
```

```bash
# Dev (runs package dev tasks via turbo)
bun run dev

# Build all packages
bun run build

# Type check all packages
bun run typecheck

# Run the main local quality gates (packages + example e2e)
bun run test

# Run docs-driven local evals (extra signal; local-only)
bun run test:evals

# Or run everything (tests + evals)
bun run test:all

# Format code
bun run format
```

## Authoring Mode

PIE Players now supports authoring mode for editing PIE items. See [docs/AUTHORING_MODE.md](docs/AUTHORING_MODE.md) for complete documentation.

### Quick Example

```html
<!-- IIFE Player with authoring mode -->
<pie-iife-player
  config='{"elements": {...}, "models": [...], "markup": "..."}'
  mode="author"
  configuration='{"@pie-element/multiple-choice": {}}'
  onmodel-updated={(e) => console.log('Updated:', e.detail)}
></pie-iife-player>
```

### Preview Components

```svelte
<script>
  import { PiePreviewLayout } from '@pie-framework/pie-players-shared/components';

  let mode = $state('author');
</script>

<PiePreviewLayout
  bind:mode
  itemConfig={config}
  configuration={configuration}
  onModelUpdated={handleUpdate}
/>
```

Try the live demo at `http://localhost:5200/authoring`

## Local packaging (no npm publish)

```bash
# Builds and produces local install artifacts in ./local-builds
bun run pack:local
```

## Local ESM CDN (test pie-elements-ng without publishing)

If you're iterating on **`pie-elements-ng`** locally and want to test the **ESM player** against those builds **without publishing**, use the sibling “local ESM CDN” server.

Assumptions:

- `pie-players` and `pie-elements-ng` are checked out as siblings:
  - `../pie-players` (this repo)
  - `../pie-elements-ng`

Workflow:

```bash
# In pie-elements-ng (start the local ESM CDN; it runs a build first by default)
cd ../pie-elements-ng
bun run local-esm-cdn

# In pie-players (start the local ESM CDN server from this repo)
cd ../pie-players
bun run local-esm-cdn

# In another terminal (run the example app)
bun run dev:example
```

Example app behavior:

- In dev, the example app uses `esmSource=auto` by default and will probe `http://localhost:5179/health`.
- If the local ESM CDN is healthy, ESM pages will default to **local** loading; otherwise they fall back to **remote** (`https://esm.sh`).
- You can override per page via query string:
  - `?esmSource=local`
  - `?esmSource=remote`
- If you run the local server on a different port, also set:
  - `LOCAL_ESM_CDN_PORT=5189 bun run local-esm-cdn`
  - and add `?localEsmCdnUrl=http://localhost:5189` to the example app URL(s)

## Documentation

### Architecture & Design

- [High-Level Architecture](docs/ARCHITECTURE.md) - Complete system architecture overview
- [Question Layout Engine Architecture](docs/question-layout-engine-architecture.md) - Layout system design
- [Tools & Accommodations Architecture](docs/tools-and-accomodations/architecture.md) - Tools system design

### Usage Guides

- [Authoring Mode Guide](docs/AUTHORING_MODE.md) - Complete authoring documentation

### Operations

- [GitHub Pages Setup](docs/GITHUB_PAGES_SETUP.md) - Deployment guide
- [NPM Token Setup](docs/NPM_TOKEN_SETUP.md) - Publishing guide
- [Workflow Strategy](docs/WORKFLOW_STRATEGY.md) - CI/CD documentation

## Architecture

The system consists of three major areas:

1. **Item Players** - Multiple player types (IIFE, ESM, Fixed, Inline) for rendering individual questions
2. **Assessment Toolkit** - Composable services for full test delivery with tools and accommodations
3. **Tools & Accommodations** - 15+ assessment tools with WCAG 2.2 AA compliance

Built on modern web standards:

- **Svelte 5** - Reactive UI framework with runes
- **TypeScript** - Type-safe development
- **Bun** - Fast all-in-one toolkit
- **Turbo** - High-performance build system
- **Vite** - Lightning-fast dev server and bundler
- **Web Components** - Standards-based custom elements (no shadow DOM)

For detailed architecture documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## License

See LICENSE file for details.
