# pie-players

PIE players and assessment toolkit with Bun + TypeScript + Svelte 5.

PIE Players ships building blocks: the item and section players, the assessment
toolkit, tools and theme. Hosts assemble their own production assessment
players from them; `packages/assessment-player` is a basic reference player for
examples ([product scope](docs/architecture/architecture.md#product-scope)).

**Docs app**: `apps/docs`
**Examples app**: `apps/section-demos`

## Quick Start

```bash
bun install
bun run dev:section -- --rebuild   # First section-demo run (builds package dist outputs)
bun run dev:section                # Section demos (daily run)
bun run dev:docs                   # Docs site
```

## Development

```bash
bun run dev      # Section demos (same as dev:section)
bun run build    # Build publishable packages (excludes apps and tools)
bun run typecheck
bun run test
bun run format   # Reformat every file with Biome (CI gates on biome lint only)
```

Requires Bun 1.3.11 and Node 22.16 (`.nvmrc`); `bun run dev` serves section-demos on port 5300.

Demo apps resolve publishable packages through **`dist/`** (and section-demos uses explicit Vite aliases for many tools). See [Demo workspace resolution](docs/development/demo-workspace-resolution.md).

## Consumer Import Rules

When consuming PIE web components from apps or other packages:

- Import custom-element registration entrypoints (for example `@pie-players/pie-assessment-toolkit/components/item-toolbar-element`), not raw package `.svelte` component files.
- Do not import package source paths like `@pie-players/<pkg>/src/...` from consumers.
- Do not use cross-package `?customElement` imports.
- Keep runtime package exports pointing to built `dist` artifacts.
- Type-check with `moduleResolution` `bundler`, `node16` or `nodenext`. `node10` (`node`) ignores `exports` and cannot resolve the subpaths these packages publish; see [Library Packaging Strategy](docs/setup/library-packaging-strategy.md#consumer-guidance-current-scope).

Boundary checks:

```bash
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

## Versioning and releases

Every publishable `@pie-players/*` package releases at one fixed (lockstep) version. Releases go out from CI through Changesets; the release flow, auth modes and local retry steps are in [Publishing Contract](docs/setup/publishing.md).

## Release Labels

Use release labels to tag a coordinated release wave.

```bash
bun run release:label                # Create annotated tag (default: pie-players-YYYY.MM.DD)
bun run release:label -- --label players-2026.02
bun run release:label:push           # Create and push tag to origin
```

## Packages

The publishable packages are listed in [Publishable packages](docs/setup/publishable_packages.md), which `check:docs:publishable-packages` keeps in step with the workspace.

## Documentation

- [Architecture](docs/architecture/architecture.md)
- [Item Player Overview](docs/item-player/overview.md)
- [Launching from LTI](docs/integrations/lti.md)
- [Publishing Contract](docs/setup/publishing.md)
- [Docs Index](docs/readme.md)

## License

MIT.
