# pie-players

PIE players and assessment toolkit with Bun + TypeScript + Svelte 5.

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
bun run dev      # Turbo dev for section-demos (see package.json "dev")
bun run build    # Build publishable packages + tools (excludes apps)
bun run typecheck
bun run test
bun run format   # Format (Biome)
```

Demo apps resolve publishable packages through **`dist/`** (and section-demos uses explicit Vite aliases for many tools). See [Demo workspace resolution](docs/development/demo-workspace-resolution.md).

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

## Versioning Policy

All publishable `@pie-players/*` packages are released with a **fixed (lockstep)
version**. At any published version, every package in the suite carries that same
version number — there is no per-package version drift.

### What this means for consumers

- Pick one `@pie-players/*` version and update every `@pie-players/*` dependency
  in your app to that version. The suite is tested and published as a cohesive
  unit at that version.
- You will never need to reason about a compatibility matrix across
  `@pie-players/*` packages. If two `@pie-players/*` packages report the same
  version, they are designed and tested to work together.
- A minor or major bump on any one package is reflected as a minor or major bump
  on **all** publishable packages, including ones whose source did not change in
  that release. This is expected — it is the cost of the lockstep guarantee
  above.

### Why fixed versioning

The publishable packages in this repo (players, tools, TTS servers, theming,
toolkits) form a single cohesive player framework. Internal contracts cross
package boundaries (element registration, theme tokens, tool coordination,
session/session-state shape), so consumers almost always adopt the suite
together rather than piecemeal. Fixed versioning removes a category of
compatibility bugs at the cost of more churn on unchanged packages per release.

### How it is enforced

- Changesets' `fixed` block in
  [`.changeset/config.json`](./.changeset/config.json) lists every publishable
  package.
- `scripts/check-fixed-versioning.mjs` runs as part of `bun run verify:publish`
  and blocks publish if any publishable package has drifted.
- Release prep always covers every publishable package — see
  [`.cursor/rules/release-version-alignment.mdc`](./.cursor/rules/release-version-alignment.mdc)
  and [`docs/setup/publishing.md`](./docs/setup/publishing.md).

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

Manual patch-only publish flow (matches CI gates):

```bash
bun run release:with-version
```

`release:with-version` creates a temporary all-packages patch changeset, runs preflight checks/tests, then publishes.
Merges to `master` also auto-generate a temporary patch changeset when needed for release PR prep.

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
**Shared**: players-shared, assessment-toolkit

## Documentation

- [Architecture](docs/architecture/architecture.md)
- [Authoring Mode](docs/AUTHORING_MODE.md)
- [NPM Token Setup](docs/setup/npm_token_setup.md)
- [Publishing Contract](docs/setup/publishing.md)
- [Docs Index](docs/README.md)

## License

See LICENSE file.
