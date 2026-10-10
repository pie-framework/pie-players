# Demo System

This monorepo uses multiple focused demo hosts instead of a single combined example app.

For how Vite resolves `@pie-players/*` in demos (`dist/` vs aliases), see [Demo workspace resolution](../development/demo-workspace-resolution.md).

Packaging boundary contract and Node-safe vs browser-only package guidance:
[`library-packaging-strategy.md`](./library-packaging-strategy.md).

## Available Demo Apps

- `apps/item-demos` for item-player focused examples
- `apps/section-demos` for section-player and toolkit examples
- `apps/assessment-demos` for assessment-player orchestration examples
- `apps/lti-demos` for host-owned LTI launch and persistence integration examples
- `apps/backend-demos` for item-player backend adapter examples
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
bun run dev:lti
bun run dev:backend
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

## Local ESM CDN

`bun run local-esm-cdn` serves a pie-elements-ng checkout (`PIE_ELEMENTS_NG_PATH`,
else the sibling `../pie-elements-ng`) as an ESM CDN on port 5179, or
`LOCAL_ESM_CDN_PORT`. It builds the checkout's React element and lib packages
first; `LOCAL_ESM_CDN_SKIP_BUILD=1` skips the build. Point the ESM player at it
with `loaderOptions.esmCdnUrl`.

`bun run dev:section:cdn` serves the same checkout, built, from the section
demos' dev server, and their `?player=esm` loads from it.
`bun run dev:section:cdn-debug` adds verbose resolution logging
(`LOCAL_ESM_CDN_DEBUG=true`).

The dev-server plugin watches the `dist/` directories of the checkout's
`packages/elements-react/*`, `packages/elements-svelte/*`, `packages/lib-react/*`
and `packages/shared/*`, and of this repository's `packages/*`, and reloads the
page when a loaded package's build changes. When the plugin does not load, check
that `pie-elements-ng` is checked out beside this repository, or that
`PIE_ELEMENTS_NG_PATH` points at it.
