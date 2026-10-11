# Versioning and stability

This page is for hosts: how the `@pie-players/*` packages are versioned, how to
pin them, what makes up their public surface, and where breaking changes
are announced. [Releasing](../setup/publishing.md) covers the maintainer side.

## Lockstep versions

The packages in [Publishable packages](../setup/publishable_packages.md)
release together at one version, and every release bumps all of them,
including packages whose source did not change. Each published package depends
on its `@pie-players/*` siblings at that exact version, so the set is tested
and installed as one unit.

Install every `@pie-players/*` package at the same version and upgrade them
together. Mixing versions installs a second copy of each shared sibling, and
whichever copy registers a custom element first defines it for the whole page.

`@pie-players/pie-preloaded-player` is the one published package outside the
lockstep set. Each build is versioned `<loaderVersion>-<set>.<iteration>`: the
item player version it is built against, the element set it bundles, and a
counter per set and item player version
([version scheme](../preloaded-player/readme.md#version-scheme)).

## Version numbers before 1.0

The packages are on the `0.x.y` line, and every release is a patch bump,
breaking changes included. A version number therefore says nothing about
compatibility: read the changelog of every release between your current
version and the target before upgrading.

## Pinning

Production installs pin an exact version:

```bash
npm install --save-exact @pie-players/pie-item-player@x.y.z @pie-players/pie-section-player@x.y.z
```

On a `0.x.y` version, a caret or tilde range (`^0.3.0`, `~0.3.0`) admits every
later patch and with it every breaking change. CDN URLs pin the same way:
`https://cdn.jsdelivr.net/npm/@pie-players/pie-item-player@x.y.z/dist/pie-item-player.js`.
A partial version (`@0.3`) or `@latest` in a URL resolves to the newest
matching release, so the page changes without a deploy.

## Dist-tags

The lockstep packages publish under npm's `latest` dist-tag only.

The preloaded player's current element set publishes under `latest`, and any
other set under a dist-tag named after it
([dist-tags](../preloaded-player/readme.md#dist-tags)). Its versions are
prereleases and sets do not sort against each other, so a caret range can
resolve to a build of a different set, and `latest` moves when the current set
changes. Pin an exact version.

## Public surface

A package's public surface is:

- each subpath in its `exports` map, with the type declarations published
  there;
- the file its `unpkg` and `jsdelivr` fields name, which a CDN serves for a URL
  without a file path;
- its custom-element tag names, attributes and properties;
- the DOM events its elements dispatch: names, `bubbles` and `composed`, detail
  shapes, and how often each fires;
- controller and coordinator methods, and the `runtime` and `hooks`
  configuration keys;
- the `--pie-*` tokens in `@pie-players/pie-theme/token-registry.json`, which
  are never renamed or dropped
  ([token registry](../../packages/theme/README.md#token-registry)).

A change to any of these is a breaking change. Everything else in the tarball
is internal, including the chunk files a build
splits out, whose names can change in any release. Node.js and exports-aware
bundlers refuse an import of a subpath the `exports` map does not list.

The packages publish built `dist` files only. No export resolves to source,
none carries a `svelte` or `development` condition, and no published
declaration imports `svelte`. Hosts install no Svelte: each custom-element
package bundles its UI runtime (Svelte 5; Lit for the print player).
[Packages and entry points](./packages.md) says which entry points run in
Node.js, in a browser, or only through a bundler.

## Breaking changes

Each release's changesets describe its changes, breaking ones included, and
releasing writes them into each affected package's `CHANGELOG.md`, for example
[`packages/item-player/CHANGELOG.md`](../../packages/item-player/CHANGELOG.md).
Each publish also creates a GitHub Release, tagged `v<version>`, that lists the
published packages and points at those changelogs.
