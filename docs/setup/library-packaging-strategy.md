# Library Packaging Strategy

This is the packaging design record for contributors: how the `@pie-players/*`
packages are built and published, the constraint behind each rule, and the
release gate that enforces it. Hosts choosing what to install read
[Packages and entry points](../install/packages.md).

## Problem

The player packages shipped as chunked ESM with internal dynamic imports and
chunk names that changed between equivalent builds. Hosts that ran them through
an optimizer layer (Vite's `optimizeDeps`, other prebundlers), or hit lockfile
churn or a stale cache, failed without a source change of their own: runtime
errors named missing `node_modules/.vite/deps/module-*.js` files, and only
clearing caches and restarting the dev server recovered. A library cannot make
that recovery part of its contract.

## Goals

1. A host never clears a cache to recover from a PIE rebuild or upgrade.
2. Every published entry point is declared in `exports` and keeps its file name
   from one build to the next.
3. Node-safe entry points are declared and tested apart from browser-only ones.
4. A package that must load without a bundler ships that build as a public,
   tested export (`@pie-players/pie-section-player/browser`).
5. Custom-element registration is race-safe under HMR and concurrent import
   paths.

## Artifact model

Each package publishes one ESM build, for bundlers and Node.js module
resolution, behind its `.` export and subpaths.

The section player adds a second build behind `./browser`, for pages without a
bundler. `vite.config.browser.ts` builds the npm entry again with nothing
external, plus the tool-registry exports `src/browser.ts` adds
(`createPackagedToolRegistry`, `DEFAULT_TOOL_MODULE_LOADERS`), into
`dist/browser/`. It has its own config and output directory, so the npm build
is unaffected. It is an application build because library mode inlines every
asset as a `data:` URL, and Chromium refuses a module worker from a `data:` URL
as large as the Cortex calculator's 4.3 MB worker script. Its chunks stay split,
so each lazily loaded tool downloads on first use.

The section player's npm build leaves the item player, the default tool loaders
and `speech-rule-engine` external. The host's one item player defines
`<pie-item-player>` and installs the math renderer for every player on the
page, and every PIE bundle shares the host's one copy of `speech-rule-engine`
and its locale tables.

## Export surface

The section player's complete `exports` map:

```json
{
  "exports": {
    ".": {
      "types": "./dist/pie-section-player.d.ts",
      "import": "./dist/pie-section-player.js"
    },
    "./browser": {
      "types": "./dist/browser.d.ts",
      "import": "./dist/browser/pie-section-player.js"
    },
    "./components/section-player-splitpane-element": {
      "types": "./dist/pie-section-player.d.ts",
      "import": "./dist/pie-section-player.js"
    },
    "./contracts/runtime-host-contract": {
      "types": "./dist/contracts/runtime-host-contract.d.ts",
      "import": "./dist/contracts/runtime-host-contract.js"
    },
    "./contracts/host-hooks": {
      "types": "./dist/contracts/host-hooks.d.ts",
      "import": "./dist/contracts/host-hooks.js"
    },
    "./policies": {
      "types": "./dist/policies/index.d.ts",
      "import": "./dist/policies/index.js"
    },
    "./item-section": {
      "types": "./dist/item-section/index.d.ts",
      "import": "./dist/item-section/index.js"
    }
  }
}
```

A component subpath maps to a documented entry file. Each contract subpath
(`./contracts/*`, `./policies`, `./item-section`) is its own Vite entry, so
importing one loads no custom element and runs in Node.js.

`scripts/publish-policy.json` lists the Node-safe entry points under
`nodeConsumerImportTargets.nodeSafe` and the browser-only roots under
`browserOnly`. [Packages and entry points](../install/packages.md#entry-points)
gives hosts the same split.

## Chunk names

The item player and section player name entry files `[name].js` and each chunk
with `chunkFileNamesFromSource` (`packages/players-shared/chunk-file-names.ts`):
`chunks/<name>-<hash>.js`, where the hash is the first eight hex digits of a
SHA-1 of the chunk's source key. The key is the path of the module the chunk
starts from, cut at `node_modules/` (kept as `npm/`) or at `src/`, or taken
relative to the workspace root for a module elsewhere in the workspace. A chunk
keeps its name from one build to the next, and no checkout path reaches the
name, because turbo's cache restores a build into whichever worktree asks for
it. The name follows the source path and not the content, so two versions can
ship different files under one chunk name: a self-hosted copy of the browser
build needs one directory per version.

Other packages that split chunks keep Vite's content-hashed default,
`[name]-[hash].js`.

Chunks are internal. `check:pack-integrity:real` fails a release in which an
export target has a hash-only or hashed-suffix file name, so no export points at
a chunk.

## Dist-only publish surface

Packages publish generated `dist` files as their public API. `exports`, `main`,
`module`, `types`, `unpkg` and `jsdelivr` point inside `dist/`, never at `src`,
a non-declaration `.ts` or `.tsx` file, or a `.svelte` or `.svelte.ts` file, and
no export carries a `development` or `svelte` condition. `check:publish-surface`
checks each manifest and its `npm pack` file list for:

- no `development` or `svelte` export condition;
- no export that `forbiddenPublicExports` in `scripts/publish-policy.json`
  lists for the package;
- no `src`, `.svelte` or non-declaration TypeScript path in `files`;
- no package-level `svelte` field, and no Svelte peer or optional dependency;
- every target inside `dist/`;
- packed files limited to `dist/`, declared `bin` files, `package.json`,
  README, LICENSE and CHANGELOG, an oclif manifest, and static assets.

Debugging needs no importable source. No package ships sourcemaps today, and
`check:sourcemaps` rejects a packed map that references a source file missing
from the tarball unless the map embeds that source's content.

Hosts install no Svelte. A package that uses Svelte lists it as a dev
dependency and bundles it into each browser entry point: `check:svelte-runtime-deps` rejects `svelte` in `dependencies` or
`optionalDependencies`, and `check:ce-consumer-contract` rejects a Svelte peer
dependency; neither has an exception today. No published declaration imports
`svelte` either, because TypeScript loads every declaration a type entry
reaches. vite-plugin-dts declares a `.svelte` file as a stub re-exporting
`SvelteComponent` from `svelte`, so a package leaves `.svelte` files out of its
dts `include` and declares any component it exports without Svelte. A package
whose bundle entry is a component also leaves off `insertTypesEntry`, which
derives the types entry from that component, and ships an `index.ts` types
entry instead. `check:svelte-type-imports`, run after a build, checks every
declaration a type entry reaches and every one the package ships.

`speech-rule-engine` is pinned to one exact version (`pinnedRuntimeDependencies`
in `scripts/publish-policy.json`, enforced by `check:package-metadata`), so
every PIE bundle a host loads resolves the same copy and the same locale-table
paths.

## Custom-element registration

Hand-written registration goes through `defineCustomElementSafely`
(`packages/players-shared/src/pie/custom-element-define.ts`). A second define
of a tag returns `already-defined`, and the first definition stays in force, so
HMR and two import paths to one element do not throw.
`check:ce-define-safety` fails on a direct `customElements.define(` outside an
allowlist of files and on a literal tag defined in more than one file.

## Type resolution

Type declarations resolve under TypeScript's `node16`, `nodenext` and `bundler`
modes. `node10`, spelled `node` in a tsconfig, is unsupported: it ignores
`exports`, through which the packages publish every subpath. TypeScript 6.0
deprecates `node10` and 7.0 removes it, so the packages carry no
`typesVersions` fallback. `check:types-publish` runs Are the Types Wrong
(`scripts/check-attw.mjs`) over every packed package and fails on a non-CSS
entry that does not resolve with types under `node16` or `bundler`; it ignores
`node10` results and CSS entries, which ATTW cannot model.
`check:undeclared-subpaths` holds every cross-package import to a subpath the
owning package exports.

## Release gates

| Rule | Gate |
| --- | --- |
| Every export target exists in the packed tarball and has a stable file name | `check:pack-integrity:real` |
| Node-safe entry points import in Node.js from installed tarballs; the browser-only roots fail on a browser global | `check:node-consumer-imports` |
| Dist-only surface | `check:publish-surface`, `check:sourcemaps` |
| No Svelte for hosts | `check:svelte-runtime-deps`, `check:ce-consumer-contract`, `check:svelte-type-imports` |
| One `speech-rule-engine` version | `check:package-metadata` |
| Race-safe registration | `check:ce-define-safety` |
| Types resolve in the supported modes | `check:types-publish`, `check:undeclared-subpaths` |

[Releasing](./publishing.md#publish-gates) lists every gate and when it runs.

## Decision

One ESM build per package with stable entry names and source-derived chunk
names, plus a self-contained build where a package must load without a bundler.
Standard bundler hosts keep code splitting, Node.js imports of the published
contracts stay reliable, and the package layout follows common JavaScript
library publishing.
