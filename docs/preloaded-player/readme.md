# Preloaded player (`@pie-players/pie-preloaded-player`)

`@pie-players/pie-preloaded-player` is a generated package: a fixed set of
pie-elements-ng elements, each pinned to one version, bundled with
`@pie-players/pie-item-player` and the MathJax files the elements load.
Importing it registers the elements, so a hosted
`<pie-item-player strategy="preloaded">` renders them without fetching bundles
at runtime. It replaces `@pie-framework/pie-fixed-player-static`.

The package is transitional, published for hosts that have not moved off
generated builds. A new integration installs the pie-elements-ng packages as npm
dependencies and registers their ESM builds with `registerPreloadedElements`
([Registering elements from npm](../item-player/loading-strategies.md#registering-elements-from-npm)),
which needs no generated build. How builds are configured, built, tested and
published is in [Preloaded player builds](../../configs/preloaded-player/README.md).

## Install

Install an exact version:

```bash
npm install --save-exact @pie-players/pie-preloaded-player@x.y.z-<set>.<iteration>
```

`npm view @pie-players/pie-preloaded-player dist-tags` lists the version each
[dist-tag](#dist-tags) points to, and
`npm view @pie-players/pie-preloaded-player@<version> pie.elements` lists the
element packages and versions a build bundles.

## Version scheme

A build's version is `<loaderVersion>-<set>.<iteration>`:

- `loaderVersion` is the version of `@pie-players/pie-item-player` the build
  bundles.
- `set` names the element set: one fixed list of element packages and versions.
- `iteration` counts the builds of that set on that loader version, so within a
  set, version order is publish order.

The package is versioned on its own, outside the lockstep `@pie-players/*`
release ([Versioning](../install/versioning.md)).

A caret range is unsafe. Semver compares the `<set>` identifiers lexically, so
`^x.y.z-<set>.2` also admits every build on loader version `x.y.z` whose set
name sorts after `<set>`, and those builds bundle other elements. Builds from
the earlier `<loaderVersion>-<hash>.<iteration>` scheme stay installable and
sort the same way.

### Dist-tags

The set configured as `latest` publishes under `latest`; a set configured
without it publishes under its own name. `next` points to a build from the
earlier scheme and no longer moves. A dist-tag moves on every publish of its
set, so a host resolves it once and pins the result:
`npm install --save-exact @pie-players/pie-preloaded-player@latest` records the
exact version `latest` points to.

## Usage

```html
<script type="module">
  import "@pie-players/pie-preloaded-player";
</script>
<pie-item-player strategy="preloaded" hosted config="..." env="..." session="...">
</pie-item-player>
```

Importing the package is its whole API. The import registers the elements under
their versioned tags, records each package's version in
`window.PIE_PRELOADED_ELEMENTS`, and defines `pie-item-player` unless the page
already has one. The entry awaits that work at the top level, so a completed
`await import("@pie-players/pie-preloaded-player")` means registration finished,
and a failed initialization rejects the import. Each internal import retries
with backoff.

A bundler that processes the entry needs an `es2022` or later target for the
top-level await: Vite 6 and earlier default to an older target and fail the
build. Every runtime import inside the package is relative, so it also loads
from any server that serves the published files as they are.

Importing the package twice is harmless: a tag the page already defined keeps
its definition and its registry entry. A package the page already registered at
another version rejects the import, because the players align every authored
version of a package to the registered one.

Content can author another version of a bundled package, or another base tag
for it, and the player renders it through the registered element
([`strategy="preloaded"`](../item-player/loading-strategies.md#strategypreloaded)).
A tag whose package the build does not bundle fails with
`ElementAssertionError`, and the player fetches no bundle in its place.

Math renders from the MathJax files the build ships, with no MathJax on the
page, and the speech menu lists only the build's speech locales
([Math rendering](../item-player/math-rendering.md#mathjax-assets)).

### Models and scoring

A build registers view elements only: it bundles each element's
`./browser/delivery` build, which carries no controller. The player rendering
them has to be hosted (`hosted`, or `backend.delivery` enabled), so its models
arrive server-processed and scoring happens on the server
([Item scoring](../item-player/scoring-and-rubrics.md)). A player that is not
hosted renders each model as authored, without running `model()`, and warns
once per tag that it has no controller.

### The build's own item player

A build carries its own copy of `@pie-players/pie-item-player` and registers it
as `pie-item-player` when that tag is free, so on a page holding no other copy
the markup above renders through it. A page that already holds one, such as any
page importing `@pie-players/pie-section-player`, renders the build's elements
through that copy, and the entry skips fetching its own. Whichever copy
registers `pie-item-player` first renders every item for the life of the
document; a full page load resets it.

## Section player

The section player renders each item through `<pie-item-player>`, and
`runtime.playerType: "preloaded"` selects this strategy
([Section player integration](../item-player/loading-strategies.md#section-player-integration)).
The section player does not import this package: the host imports it before
mounting the section player, and the build's elements render through the
section player's copy of the item player. The section player's pre-warm asserts
every tag the section's items and passages name. A missing tag leaves the items
unmounted and raises a non-recoverable `element-preload` framework error, which
is also the section's `section-error`; the `pie-stage-change` chain ends on a
`failed` stage and no `pie-loading-complete` follows
([Preloaded elements](../../packages/section-player/README.md#preloaded-elements)).

## Upgrading from `pie-fixed-player-static`

`<pie-item-player>` takes the properties `<pie-fixed-player>` took: `config`,
`session`, `env`, `addCorrectResponse`, `renderStimulus`, `allowedResize`,
`showBottomBorder`, `customClassname` (now `customClassName`),
`containerClass`, `passageContainerClass`, `externalStyleUrls`, `loaderConfig`
and `debug`. Both render server-processed models with elements that carry no
controller. To upgrade:

- Import `@pie-players/pie-preloaded-player` in place of
  `@pie-framework/pie-fixed-player-static`, and render
  `<pie-item-player strategy="preloaded" hosted ...>` in place of
  `<pie-fixed-player ...>`.
- Mount the player once the import has completed. `<pie-fixed-player>` trusted
  that the elements were registered; `strategy="preloaded"` checks and throws
  `ElementAssertionError` when the player mounts first.
- Check stylesheet origins: `externalStyleUrls` loads same-origin sheets unless
  `allowed-style-origins` names others
  ([Stylesheets](../item-player/migration-from-pie-player-components.md#stylesheets)).
- A build exists only for an element set configured in pie-players. A
  combination no published set carries needs a new set
  ([Preloaded player builds](../../configs/preloaded-player/README.md)).

The load signal is unchanged. The entry dispatches `PiePlayerLoadEvent` on
`document` with detail `PIE-Fixed-Player-Load-Complete`, marks
`PIE-Fixed-Player-Load-Complete` on the performance timeline, and sets
`window.pieFixedPlayerLoaded = true` for a host that initializes after the
player and misses the dispatch. A failed initialization dispatches
`PIE-Fixed-Player-Load-Failed` before the import rejects.
