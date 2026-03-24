# Demo System

This monorepo uses multiple focused demo hosts instead of a single combined example app.

For how Vite resolves `@pie-players/*` in demos (`dist/` vs aliases), see [Demo workspace resolution](../development/demo-workspace-resolution.md).

Packaging boundary contract and Node-safe vs browser-only package guidance:
[`library-packaging-strategy.md`](./library-packaging-strategy.md).

## Available Demo Apps

- `apps/item-demos` for item-player focused examples
- `apps/section-demos` for section-player and toolkit examples
- `apps/docs` for documentation and static examples

## Local Commands

From repository root:

```bash
# First run (after bun install) for deterministic package artifacts
bun run dev:section -- --rebuild

# Daily demo commands
bun run dev:item
bun run dev:section
bun run dev:assessment
bun run dev:docs
```

For section demo + tool-package iteration, run this in a second terminal:

```bash
bun run build:watch:section-tools
```

All demo entrypoints are root scripts. Avoid running `bun run dev` from inside
an app folder when you need monorepo env + package orchestration behavior.

## CDN-Like Package Serving

Use the package server for local distribution-style testing:

```bash
bun run dev:demo
```

This serves built package artifacts from workspace packages (see `scripts/serve-packages.ts`).
