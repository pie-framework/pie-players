# pie-players

PIE players and assessment toolkit with Bun + TypeScript + Svelte 5.

**Docs**: <https://pie-framework.github.io/pie-players/>
**Examples**: <https://pie-framework.github.io/pie-players/examples/>

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

## Releasing From Workspace

This monorepo keeps internal dependencies as `workspace:*` during development.

On release, `bun run release` runs a publish wrapper that temporarily rewrites workspace
ranges to concrete package versions, executes `changeset publish`, then restores the
original workspace ranges. This avoids leaking `workspace:*` into npm metadata while
keeping local development ergonomics unchanged.

Before release merges/publishes, run:

```bash
bun run verify:publish
```

## Release Labels

Use release labels to tag a coordinated release wave without forcing lockstep package versions.

```bash
bun run release:label                # Create annotated tag (default: pie-players-YYYY.MM.DD)
bun run release:label -- --label players-2026.02
bun run release:label:push           # Create and push tag to origin
```

## Packages

**Interactive Players**: pie-iife-player, pie-esm-player, pie-fixed-player, pie-inline-player
**Print Player**: print-player - Item-level print rendering for production use
**Tools**: calculator, graph, ruler, protractor, magnifier, annotation-toolbar, color-scheme, periodic-table
**Math Rendering**: math-renderer-core, math-renderer-mathjax, math-renderer-katex
**Shared**: players-shared, assessment-toolkit

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Math Renderer Architecture](MATH-RENDERER-ARCHITECTURE.md) - Pluggable math rendering system
- [Authoring Mode](docs/AUTHORING_MODE.md)
- [GitHub Pages Setup](docs/GITHUB_PAGES_SETUP.md)
- [NPM Token Setup](docs/NPM_TOKEN_SETUP.md)
- [Publishing Contract](docs/publishing.md)
- [Workflow Strategy](docs/WORKFLOW_STRATEGY.md)

## License

See LICENSE file.
