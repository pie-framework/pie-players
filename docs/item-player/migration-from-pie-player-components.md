# Migration from the legacy PIE players

The `@pie-players/*` packages replace the legacy PIE players. PIE stands for
Portable Interactions and Elements. This guide maps each legacy element,
property, event and method to its replacement, and says what a host changes
where behavior differs. The
[item player README](../../packages/item-player/README.md) is the API
reference.

## Element mapping

| Legacy | Replacement |
| --- | --- |
| `<pie-player>` from [`@pie-framework/pie-player-components`](https://github.com/pie-framework/pie-player-components) | `<pie-item-player>` from `@pie-players/pie-item-player` |
| `<pie-author>` from `@pie-framework/pie-player-components` | `<pie-item-player mode="author">` ([Authoring](#authoring)) |
| `<pie-api-player>`, `<pie-api-author>` | `<pie-item-player>` with the `backend` property ([PIE API backend](#pie-api-backend)) |
| `<pie-fixed-player>` from `@pie-framework/pie-fixed-player-static` | `<pie-item-player strategy="preloaded">` with a generated preloaded build ([Fixed player](#fixed-player)) |
| `<pie-print>` from `@pie-framework/pie-print` | `<pie-print>` from `@pie-players/pie-print-player` ([Print player](#print-player)) |

One element serves delivery and authoring, and `mode` defaults to `"view"`:

```html
<!-- Delivery -->
<pie-item-player mode="view" config="..." env="..." session="..."></pie-item-player>

<!-- Authoring -->
<pie-item-player mode="author" config="..." configuration="..."></pie-item-player>
```

## Property mapping

The properties of `<pie-player>` and `<pie-author>`. Attribute forms are
kebab-case (`add-correct-response`).

| Legacy | `<pie-item-player>` |
| --- | --- |
| `config`, `session`, `env`, `hosted`, `addCorrectResponse`, `showBottomBorder`, `renderStimulus`, `allowedResize`, `containerClass`, `passageContainerClass`, `baseHeadingLevel`, `includeSrHeading`, `loaderConfig` | Same names |
| `disableBundler` | `strategy="preloaded"` ([Element loading](#element-loading)) |
| `bundleHost` | `loaderOptions.bundleHost` |
| `customClassname` | `customClassName` (`custom-class-name`) |
| `externalStyleUrls` | `externalStyleUrls`, restricted to the page's origin unless `allowed-style-origins` names others ([Stylesheets](#stylesheets)) |
| `configSettings` | `configuration`, with authoring-only settings under `configuration.authoring` ([Authoring](#authoring)) |
| `imageSupport` | `onInsertImage`, `onDeleteImage` |
| `uploadSoundSupport` | `onInsertSound`, `onDeleteSound` |
| `addRubric`, `defaultComplexRubricModel` | None: the rubric's element and model go in `config` ([Rubrics](#rubrics)) |
| `addPreview` | None: a second `<pie-item-player>` in view mode renders the preview |
| `canWatchConfigSettings` | None: a `configuration` with new content re-renders the authoring view |
| `bundleEndpoints`, `reFetchBundle`, `version`, `isInsidePieApiAuthor` | None |

## Event and method mapping

| Legacy | `<pie-item-player>` |
| --- | --- |
| `session-changed`, the element's own event, detail `{ complete, component }` | `session-changed` from the player, with `elementId` and `session` added to the detail ([Sessions](#sessions)) |
| `load-complete` | `load-complete` ([Load completion](./loading-strategies.md#load-completion)) |
| `player-error`, detail a string | `player-error`, detail `{ code, message, recoverable, ... }` |
| `responseCompleted` | None; `<pie-player>` declared it and never emitted it |
| `modelLoaded`, detail the whole config | `model-loaded`, detail `{ models, configuration }` ([Authoring](#authoring)) |
| `modelUpdated`, detail the whole config | `model-updated`, detail `{ update, reset }` for one model ([Authoring](#authoring)) |
| `provideScore()` | `provideScore()`, with the same result ([Scoring](#scoring)) |
| `validateModels()` | `validateModels()` |
| `updateElementModel(update)` | Assign a new `config` |
| `addRubricToConfig()`, `addMultiTraitRubricToConfig()` | None ([Rubrics](#rubrics)) |
| The flat properties and events of `<pie-api-player>` and `<pie-api-author>` (`token`, `itemId`, `contentLoaded`, `sessionSaved`) | `backend.auth`, `backend.delivery`, `backend.authoring` and the `backend-*` events ([PIE API backend](#pie-api-backend)) |

## Element loading

`<pie-player>` loaded IIFE bundles from the bundle host, the server that builds
and serves bundles of the element packages an item names, and registered the
elements from `window.pie`. `<pie-item-player>` takes a `strategy`:

- `iife`, the default, loads the same bundles from the same bundle host. The
  bundles populate `window.pie`, and the IIFE adapter registers the elements
  from it.
- `esm` imports each element's browser ESM build from an npm CDN. Only
  pie-elements-ng packages publish one.
- `preloaded` loads nothing: the host registers the elements with
  `registerPreloadedElements` before the player renders. A tag the host did not
  register fails the load with `player-error`, where `disableBundler` rendered
  the item without it.

Nothing populates `window.pie` under `esm` and `preloaded`, so host code that
reads it works under `iife` alone. A host that evaluates IIFE bundles itself
awaits `ensureItemPlayerMathRenderingReady()` before the first one runs
([`strategy="iife"`](./loading-strategies.md#strategyiife)).
[Loading strategies](./loading-strategies.md) covers each strategy.

## Tag naming

`<pie-player>` registered each element under a `pp-` tag derived from its
package name (`pp-pie-element-multiple-choice`). `<pie-item-player>` registers
it under a versioned tag (`multiple-choice--version-14-0-3`), so two versions of
one element can share a page. Host code that finds an element by tag compares
base names: `parseVersionedTagName` from
`@pie-players/pie-players-shared/pie/tag-names` splits a runtime tag into its
base name and version.

## Authoring

- `configSettings` becomes `configuration`. Authoring-only settings go under
  `configuration.authoring`, apart from delivery settings. A key names the full
  versioned tag, the package spec, the package name or the package base name;
  the versioned tag is the most specific, and the only key that tells two
  versions of one element apart
  ([Authoring configuration](../../packages/item-player/README.md#authoring-configuration)
  gives the resolution order).
- `model-loaded` carries `{ models, configuration }`, and `model-updated` the
  configure element's `{ update, reset }` for the one model it changed.
  `<pie-author>` sent the whole config on both. The player applies the update
  to its own copy of the config and leaves the host's object as it was, so a
  host that saved `event.detail` merges `detail.update` into its config by
  model `id`: it replaces the model when `reset` is true, and the model keeps
  its `id` and `element` either way.
- Media hooks replace `imageSupport` and `uploadSoundSupport`.
  `authoring-backend="demo"`, the default, installs data-URL handlers for demos.
  `authoring-backend="required"` makes the host supply `onInsertImage`,
  `onDeleteImage`, `onInsertSound` and `onDeleteSound`, and blocks authoring
  with a `player-error` while one is missing
  ([Authoring media hooks](../../packages/item-player/README.md#authoring-media-hooks)).

```ts
const el = document.querySelector("pie-item-player");
el.mode = "author";
el.configuration = {
  "@pie-element/multiple-choice@14.0.3": {
    sharedSetting: true,
  },
  authoring: {
    "multiple-choice--version-14-0-3": {
      authoringOnlySetting: true,
    },
  },
};

el.addEventListener("model-updated", (event) => {
  const { update, reset } = event.detail;
  config.models = config.models.map((model) =>
    model.id === update.id
      ? { ...(reset ? {} : model), ...update, id: model.id, element: model.element }
      : model,
  );
});

const validation = await el.validateModels();
```

### Rubrics

`<pie-player>` appended the markup of an `@pie-element/rubric` model that the
item's markup lacked, and `<pie-author>` added rubric elements and models
through `addRubric`, `addRubricToConfig()` and `addMultiTraitRubricToConfig()`.
`<pie-item-player>` renders the config as given. The host puts the rubric's
element and model in `config`, and `addRubricIfNeeded(config)` from
`@pie-players/pie-players-shared/pie` appends the markup for an
`@pie-element/rubric` model the markup does not place:

```ts
import { addRubricIfNeeded } from "@pie-players/pie-players-shared/pie";

player.config = addRubricIfNeeded(config);
```

## Sessions

`<pie-player>` let each element's own `session-changed` bubble to the host, with
the element as the event's target. `<pie-item-player>` stops the element's event
and dispatches its own from the player element:

- `detail.complete` and `detail.component` are the element's.
- `detail.elementId` is the id of the element that changed, so a host that read
  the element off `event.target` reads it there.
- `detail.session` is the item's session container after the change,
  `{ id, data: [{ id, element, ... }] }`.
- An event that changes only metadata such as `complete` arrives with
  `session: null` and `intent: "metadata-only"`. The exception is the first
  event after an element's controller wrote derived state, such as a shuffled
  choice order, into the session: that write dispatches no event of its own, so
  the next one carries the session, without `intent`. An event that changes
  nothing does not reach the host.
- A commit the player sends at teardown, at navigation, or when the page is
  hidden adds `sessionCommitReason`: `"teardown"`, `"navigate"` or
  `"page-hidden"`.

A session with no `value` field does not replace a session with the same `id`
whose `value` holds a response, whether an element re-announces it after a
re-render or the host assigns it, so the learner's answer stays in place. A
host that resets an item assigns a session with a new `id`.

### `detail.session` is the authoritative read

The player keeps the item's session in its `ItemController` and publishes it on
`session-changed` as `detail.session`. That is the read to port to.

`<pie-player>` worked the other way round: `findOrAddSession` pushed each
element's entry into the host's own `session.data` array and the element mutated
that entry in place, so `player.session.data[0].value` was live inside a
`session-changed` handler. `<pie-item-player>` keeps that read working: it
projects each committed session onto the container the host passed, seeding the
`{ id }` entries the legacy player seeded, so a host that indexes
`player.session.data[0]` still finds its entry.

```js
player.addEventListener("session-changed", (event) => {
  const data = event.detail?.session?.data ?? [];   // authoritative
});
```

Two limits on the projection. A frozen container, or one object shared as a
default across items, is left untouched: the player will not write one item's
entries into state another item also reads. And inside a section player layout
(`<pie-section-player-splitpane>`, `-vertical`, `-tabbed`) each item player is
handed a per-render copy, because the composition's own session object is
section state that `persist()` saves, so a host reads a section's item
responses from the section controller.

## Markup sanitizer

`<pie-player>` set the item's markup unsanitized. `<pie-item-player>` sanitizes
it by default: it removes scripts, iframes, `<style>` and `<form>` elements,
event-handler attributes and `javascript:` URLs, and keeps a custom element
only when it is a `pie-*` tag or one of the item's own elements
([Sanitizer guarantees](../security/readme.md#sanitizer-guarantees)). Content
that needs more, such as an embedded iframe or a custom element from outside
PIE, takes an escape hatch that moves the guarantee to the host: a
`sanitizeMarkup` function in place of the default, or `trust-markup` for markup
the host has already validated
([Escape hatches](../security/readme.md#escape-hatches)).

## Stylesheets

`external-style-urls` keeps its comma-separated form, and each sheet is still
scoped to the player, under `custom-class-name` or a class the player
generates. `<pie-player>` fetched a sheet from any origin. `<pie-item-player>`
loads same-origin URLs only, unless `allowed-style-origins` names origins; then
it loads those origins only, so a list that names any origin names the page's
own as well. A cross-origin sheet is applied from a `<link>` and reaches the
whole page, because the player cannot fetch and rewrite it.

The player also installs the PIE content stylesheet,
`@pie-players/pie-theme/components.css`, at import, scoped to
`[data-pie-content]`. A host that ships its own copy sets
`data-pie-content-styles="host"` on `<html>`
([Content styles](../../packages/item-player/README.md#content-styles)).

## Scoring

`provideScore()` returns what it returned under `<pie-player>`: one entry per
model, the element's session merged with its controller's outcome, `undefined`
for a model whose element or controller is missing, and `false` when the config
has no models. The controllers receive the host's whole `env` in evaluate mode,
where `<pie-player>` passed only the mode and `partialScoring`. A hosted player
runs no controllers, so every entry is `undefined`; server scoring is `score()`
([Scoring and rubrics](./scoring-and-rubrics.md)).

## PIE API backend

`<pie-api-player>` and `<pie-api-author>` loaded and saved items and sessions
through the PIE API backend, the PIE service that stores and scores them, with
flat properties and events. `<pie-item-player>` groups them under one `backend`
property: `backend.auth` for the token, `backend.delivery` for item and session
load, autosave, save and server scoring, and `backend.authoring` for content
load, save and release. The PIE API backend serves authoring over GraphQL, so
`backend.authoring` runs through a client the host supplies. The `backend-*`
events replace the legacy ones ([Backend support](./backend-support.md)).

## Fixed player

A host on `<pie-fixed-player>` installs a generated
`@pie-players/pie-preloaded-player` build, which bundles a fixed set of
elements with the item player, and renders `<pie-item-player strategy="preloaded">`
in its place. The build announces its load with the fixed player's signal, the
`PiePlayerLoadEvent` on `document`. `<pie-fixed-player>` trusted that the
elements were registered; `<pie-item-player>` checks, and fails if it mounts
before the build has finished importing
([Upgrading from pie-fixed-player-static](../preloaded-player/readme.md#upgrading-from-pie-fixed-player-static)).

## Print player

`@pie-players/pie-print-player` keeps the `<pie-print>` API of
`@pie-framework/pie-print`, `config`, `resolve` and `missingElement`, and adds
`trustMarkup`, `sanitizeMarkup` and `config.accessibility`
([print player README](../../packages/print-player/README.md)). The script tag
changes:

```diff
- <script type="module" src="https://cdn.jsdelivr.net/npm/@pie-framework/pie-print@2.7.0/lib/pie-print.js"></script>
+ <script type="module" src="https://cdn.jsdelivr.net/npm/@pie-players/pie-print-player@x.y.z/dist/print-player.js"></script>
```

The default resolver loads each element's `dist/browser/print/index.js`, which
only pie-elements-ng packages publish. `@pie-framework/pie-print` loaded
`module/print.js`, which the legacy pie-elements packages publish. A host whose
items name pie-elements versions moves them to pie-elements-ng versions, or
resolves those packages to `module/print.js`, which loads without a `loader`:

```javascript
player.resolve = (tagName, pkg) =>
  Promise.resolve({
    tagName,
    pkg,
    url: `https://cdn.jsdelivr.net/npm/${pkg}/module/print.js`,
    module: true,
  });
```

## What is not changing

- The default bundle host is `https://proxy.pie-api.com/bundles/`.
- PIE elements (`@pie-element/*`) keep their contract: the player sets `model`,
  `session` and `env` on each registered element.
- The item config keeps its shape, `{ elements, models, markup }`, and a
  stimulus item is still a `{ pie, passage }` config.
