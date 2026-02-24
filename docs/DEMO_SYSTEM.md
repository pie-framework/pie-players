# Demo System

This monorepo uses multiple focused demo hosts instead of a single combined example app.

## Available Demo Apps

- `apps/item-demos` for item-player focused examples
- `apps/section-demos` for section-player and toolkit examples
- `apps/docs` for documentation and static examples

## Local Commands

From repository root:

```bash
bun run dev:item
bun run dev:section
bun run dev:docs
```

## CDN-Like Package Serving

Use the package server for local distribution-style testing:

```bash
bun run dev:demo
```

This serves built package artifacts from workspace packages (see `scripts/serve-packages.ts`).
