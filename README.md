# pie-players

PIE players and assessment toolkit with Bun + TypeScript + Svelte 5.

**Docs**: <https://pie-framework.github.io/pie-players/>
**Examples**: <https://pie-framework.github.io/pie-players/examples/>

## Quick Start

```bash
bun install
bun run dev:docs      # Docs site
bun run dev:example   # Examples app
```

## Development

```bash
bun dev          # Watch all packages
bun build        # Build all
bun typecheck    # Type check
bun test         # Run tests
bun format       # Format code
```

## Packages

**Interactive Players**: pie-iife-player, pie-esm-player, pie-fixed-player, pie-inline-player
**Print Player**: print-player - Item-level print rendering for production use
**Tools**: calculator, graph, ruler, protractor, magnifier, annotation-toolbar, color-scheme, periodic-table
**Assessment**: pie-assessment-player
**Math Rendering**: math-renderer-core, math-renderer-mathjax, math-renderer-katex
**Shared**: players-shared, assessment-toolkit

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Math Renderer Architecture](MATH-RENDERER-ARCHITECTURE.md) - Pluggable math rendering system
- [Authoring Mode](docs/AUTHORING_MODE.md)
- [GitHub Pages Setup](docs/GITHUB_PAGES_SETUP.md)
- [NPM Token Setup](docs/NPM_TOKEN_SETUP.md)
- [Workflow Strategy](docs/WORKFLOW_STRATEGY.md)

## License

See LICENSE file.
