# Demo System

This page is for contributors working in this repository. It covers the demo
apps, the root commands that run them, how the apps resolve the workspace
packages, and the two local servers that stand in for a CDN. The demo apps'
environment variables are in [Environment setup](./environment-setup.md).

## Prerequisites

- Bun 1.3.11 or later (`packageManager` pins `bun@1.3.11`) and Node.js 22.16.0
  (`.nvmrc`).
- Playwright's browsers, for the end-to-end suites:
  `bunx playwright install chromium firefox webkit`.
- A pie-elements-ng checkout beside this repository, or `PIE_ELEMENTS_NG_PATH`
  pointing at one, for the [local ESM CDN](#local-esm-cdn) only.

`bun install` runs the `prepare` script, which installs the Lefthook git hooks
and syncs SvelteKit's generated files. The pre-commit hook runs
`bun run verify:pre-commit`; the pre-push hook runs `bun run verify:pre-push`,
the local PR gate with the critical Playwright suites.

## Available Demo Apps

| App | Command | Port | Demonstrates |
| --- | --- | --- | --- |
| `apps/section-demos` | `bun run dev:section` | 5300 | The section player and the assessment toolkit's tools |
| `apps/item-demos` | `bun run dev:item` | 5301 | The item player |
| `apps/assessment-demos` | `bun run dev:assessment` | 5500 | The reference assessment player |
| `apps/lti-demos` | `bun run dev:lti` | 5600 | An LTI launch with server-side persistence ([reference demo](../integrations/lti.md#reference-demo)) |
| `apps/backend-demos` | `bun run dev:backend` | 5600 | The item player's backend adapters |
| `apps/docs` | `bun run dev:docs` | 5173 | A static landing page |

`bun run dev` runs `dev:section`. Every app except `apps/docs` opens a browser
tab. A taken port moves the server to the next free one, so `dev:lti` and
`dev:backend` running together take 5600 and 5601.

Two apps serve no pages of their own: `apps/local-esm-cdn` is the
[local ESM CDN](#local-esm-cdn), and `apps/demo-ui` holds the header, menu bar,
locale selector and element-version helpers the demo apps share.

## Local Commands

Demo commands run from the repository root. Each root `dev:*` script runs under
`dotenvx run --`, which loads the root `.env`. `dev:item`, `dev:section`,
`dev:assessment` and `dev:lti` start through a bootstrap script that:

- with `--rebuild`, clears the app's `.svelte-kit` and Vite caches, runs
  `bun run build`, and starts Vite with `--force`;
- syncs SvelteKit's generated files when they are missing;
- without `--rebuild`, stops with a hint when a package build the app needs is
  missing;
- binds to `127.0.0.1` unless `--host` is given, and passes any other argument
  after `--` to Vite.

The first run after `bun install` builds the packages; later runs start against
the existing builds:

```bash
bun run dev:section -- --rebuild

bun run dev:section
```

### Quick Reference

| Command | Runs |
| --- | --- |
| `bun install` | Dependency install, git hooks, SvelteKit sync |
| `bun run build` | Every publishable package through Turbo; apps and `tools/` excluded |
| `bun run dev:item`, `dev:section`, `dev:assessment`, `dev:lti`, `dev:backend`, `dev:docs` | One demo app (table above) |
| `bun run build:watch:section-tools` | Turbo watch over the section player, the toolkit, every tool package and the section-player debug tools |
| `bun run test` | Every package's unit tests through Turbo, then every app's |
| `bun run test:e2e:item-player`, `test:e2e:section-player`, `test:e2e:assessment-player` | One Playwright suite; each builds what it needs and serves its app on a free port |
| `bun run typecheck` | `turbo typecheck` |
| `bun run lint` | Biome lint, then each workspace's `check` script (`svelte-check` in most) through Turbo |
| `bun run format` | `biome format --write .` over the repository; the gates run Biome lint only |
| `bun run verify:publish` | The build and every publish gate ([Releasing](./publishing.md#publish-gates)) |

## Package Resolution

The demo apps import `@pie-players/*` as a host does: each package's `exports`
points at `dist/`, so a demo runs what npm publishes, and a source change
reaches a demo once its package rebuilds. `bun run build` rebuilds everything;
`bun run --cwd packages/<dir> build` rebuilds one package.
`bun run build:watch:section-tools` keeps the section-side packages current
while the section demos run. The section demos reload the whole page when a
package's `dist/` JavaScript changes, because re-evaluating a bundle through
HMR would define its custom elements a second time, which the browser rejects.

- `apps/section-demos` aliases the TTS client, the Desmos and GeoGebra
  calculators and ten tool packages to their entry files under `dist/`, the
  files npm resolution reaches, and aliases
  `@pie-players/pie-section-player-tools-shared` to its source `index.ts`.
  Every other import resolves through `exports`.
- `apps/assessment-demos` aliases `@pie-players/pie-section-player-tools-shared`
  to its source `index.ts` and resolves every other import through `exports`.
- `apps/item-demos`, `apps/lti-demos`, `apps/backend-demos` and `apps/docs`
  resolve every import through `exports`.

Three checks, all in `verify:pre-commit`, hold this boundary:

- `check:consumer-boundaries` fails when an app imports a package's `src/`
  path, a `.svelte?customElement` file or a component `.svelte` file.
- `check:source-exports` runs the publish-surface check, which keeps every
  manifest target inside `dist/`.
- `check:custom-elements` checks each custom-element package's tags, its build
  and check scripts, its `main`, `exports`, `unpkg` and `jsdelivr` fields, and
  `dist` in `files`. `check:custom-elements:dist` checks after a build that no
  published JavaScript imports a `.svelte` file.

[Library packaging strategy](./library-packaging-strategy.md) covers how the
packages are built and the release gates.

## CDN-Like Package Serving

`bun run dev:demo` serves every workspace package's files on port 4874 with
CDN-style URLs, CORS open to every origin and `Cache-Control: no-cache`. It
stands in for jsDelivr when a page that loads the players by CDN URL, such as
the [npm CDN examples](../install/cdn.md), should run a local build:

- `/@pie-players/<name>/<file>` serves `<file>` from the package's `dist/`;
- `/@pie-players/<name>/<version>/<file>` serves `<file>` from the package
  directory and ignores the version;
- `/@pie-players/<name>` redirects to `/@pie-players/<name>/dist/`.

For example,
`http://localhost:4874/@pie-players/pie-item-player/dist/pie-item-player.js`
serves the workspace build of the item player.

## Local ESM CDN

`bun run local-esm-cdn` serves a pie-elements-ng checkout (`PIE_ELEMENTS_NG_PATH`,
else the sibling `../pie-elements-ng`) as an ESM CDN on port 5179, or
`LOCAL_ESM_CDN_PORT`. It builds the checkout's React element and lib packages
first; `LOCAL_ESM_CDN_SKIP_BUILD=1` skips the build. Point the ESM player at it
with `loaderOptions.esmCdnUrl`.

`bun run dev:section:cdn` builds `apps/local-esm-cdn` and serves the same
checkout, built, from the section demos' dev server. Their `?player=esm` loads
elements from it, and under `?player=preloaded` the `@pie-element/*` imports
resolve to its builds, so the pages register the checkout's version. The script
starts Vite without the bootstrap, so the packages need a prior build.
`bun run --cwd apps/section-demos dev:cdn-debug` does the same with verbose
resolution logging (`LOCAL_ESM_CDN_DEBUG=true`).
`bun run test:e2e:section-player:local-esm-cdn` runs the specs for this path.

The dev-server plugin watches the `dist/` directories of the checkout's
`packages/elements-react/*`, `packages/elements-svelte/*`, `packages/lib-react/*`
and `packages/shared/*`, and of this repository's `packages/*`, and reloads the
page when a loaded package's build changes. When the plugin does not load, check
that `pie-elements-ng` is checked out beside this repository, or that
`PIE_ELEMENTS_NG_PATH` points at it.
