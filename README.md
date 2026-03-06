# pie-players

PIE players and assessment toolkit with Bun + TypeScript + Svelte 5.

**Docs app**: `apps/docs`
**Examples app**: `apps/section-demos`

## Quick Start

```bash
bun install
bun run dev:docs      # Docs site
bun run dev:section   # Section demos
```

## Development

```bash
bun dev          # Watch all packages
bun build        # Build all
bun typecheck    # Type check
bun test         # Run tests
bun format       # Format code
```

## Consumer Import Rules

When consuming PIE web components from apps or other packages:

- Import custom-element registration entrypoints (for example `@pie-players/pie-assessment-toolkit/components/item-toolbar-element`), not raw package `.svelte` component files.
- Do not import package source paths like `@pie-players/<pkg>/src/...` from consumers.
- Do not use cross-package `?customElement` imports.
- Keep runtime package exports pointing to built `dist` artifacts.

Boundary checks:

```bash
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

## Releasing From Workspace

This monorepo keeps internal dependencies as `workspace:*` during development.

All publishable `@pie-players/*` packages follow a fixed lockstep version train.
When a release wave is cut, every publishable package lands on the same version.

On release, `bun run release` runs a publish wrapper that temporarily rewrites workspace
ranges to concrete package versions, executes `changeset publish`, then restores the
original workspace ranges. This avoids leaking `workspace:*` into npm metadata while
keeping local development ergonomics unchanged.

Before release merges/publishes, run:

```bash
bun run verify:publish
```

Manual publish flow (matches CI gates):

```bash
bun run version
bun run release:manual
```

`release:manual` executes publish preflight checks and tests before publish.

### Registry switching (CodeArtifact vs npmjs)

Use npmjs for publishing `@pie-players/*`, and switch back to CodeArtifact for
private consumer installs when needed.

```bash
# one command on npmjs (preferred)
NPM_CONFIG_REGISTRY=https://registry.npmjs.org npm whoami

# publish path on npmjs
NPM_CONFIG_REGISTRY=https://registry.npmjs.org bun run release

# set current registry to npmjs
npm config set registry https://registry.npmjs.org/

# set current registry back to CodeArtifact
npm config set registry https://renaissance-112784725199.d.codeartifact.us-east-1.amazonaws.com/npm/npm-rgp/
```

## Release Labels

Use release labels to tag a coordinated release wave without forcing lockstep package versions.

```bash
bun run release:label                # Create annotated tag (default: pie-players-YYYY.MM.DD)
bun run release:label -- --label players-2026.02
bun run release:label:push           # Create and push tag to origin
```

## Packages

**Interactive Players**: pie-item-player
**Print Player**: print-player - Item-level print rendering for production use
**Tools**: calculator, graph, ruler, protractor, annotation-toolbar, color-scheme, periodic-table
**Math Rendering**: math-renderer-core, math-renderer-mathjax, math-renderer-katex
**Shared**: players-shared, assessment-toolkit

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Math Renderer Architecture](docs/MATH-RENDERER-ARCHITECTURE.md) - Pluggable math rendering system
- [Authoring Mode](docs/AUTHORING_MODE.md)
- [NPM Token Setup](docs/NPM_TOKEN_SETUP.md)
- [Publishing Contract](docs/publishing.md)
- [Docs Index](docs/README.md)

## License

See LICENSE file.
