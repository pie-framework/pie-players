# @pie-players/pie-item-player

`<pie-item-player>` renders one PIE item: it loads the PIE elements the item
names, renders the item's markup with them, and reports the learner's session to
the host. One element covers delivery, evaluation and authoring through its
`mode`, and loads elements by one of three strategies (`iife`, `esm`,
`preloaded`). PIE stands for Portable Interactions and Elements. This README is
the element's API reference, for hosts that render items;
[Getting started](../../docs/getting-started.md) renders a first item, and the
[architecture](../../docs/item-player/overview.md) page covers the session
pipeline.

The package replaces `@pie-framework/pie-player-components`, with one element
in place of its `<pie-player>` and `<pie-author>`
([migration guide](../../docs/item-player/migration-from-pie-player-components.md)).

## Install

```bash
npm install @pie-players/pie-item-player
# or
bun add @pie-players/pie-item-player
```

```ts
import "@pie-players/pie-item-player";
```

The import registers `<pie-item-player>`. The root entry imports no bare
specifier, so a page without a build step loads it from an npm CDN as a module
script ([Loading from a CDN](../../docs/install/cdn.md#item-player)). Pin the
version exactly:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@pie-players/pie-item-player@x.y.z/dist/pie-item-player.js"></script>
```

The package is browser-only: it defines a DOM custom element and does not load
under Node.js. The Node-safe entry points are listed in
[Packages and entry points](../../docs/install/packages.md#node-safe).

## Quick start

```html
<pie-item-player id="player"></pie-item-player>

<script type="module">
  const player = document.getElementById("player");
  player.config = {
    elements: { "multiple-choice": "@pie-element/multiple-choice@14.0.3" },
    models: [
      {
        id: "q1",
        element: "multiple-choice",
        prompt: "Which city is the capital of France?",
        choiceMode: "radio",
        choices: [
          { label: "Paris", value: "paris", correct: true },
          { label: "London", value: "london" },
        ],
      },
    ],
    markup: '<multiple-choice id="q1"></multiple-choice>',
  };
  player.env = { mode: "gather", role: "student" };
  player.session = { id: "session-1", data: [] };
  player.addEventListener("session-changed", (event) => {
    if (event.detail.session) console.log(event.detail.session);
  });
</script>
```

`config`, `env` and `session` are properties; set as attributes, they take JSON.

## Content styles

Authored content relies on shared classes that belong to no single component:
passage markup (`.numbered-paragraph`, `.p-number`, `div.passage-title` /
`-subtitle` / `-author`), the legacy `kds-*` content classes, and the
`pie-answer-eliminator-*` / `pie-answer-masked-*` families. They live in
`@pie-players/pie-theme/components.css`.

The player installs that stylesheet itself, so importing the element is all a
host needs, CDN hosts included. The stylesheet is bundled into the player as
text and installed once per document at import, before any instance renders. It
is prepended to `<head>`, so host CSS that comes later wins at equal
specificity. Installation is idempotent: several player packages, or several
copies of one, yield a single copy.

Content rules apply inside a `[data-pie-content]` element only. The player sets
the attribute on the root it renders into, so the stylesheet's bare `h1`–`h6`,
`table`, `th`, `.table` and `.center` selectors do not restyle the page around
it. Each selector is wrapped in `:where()`, which keeps its specificity. A host
that renders authored markup itself, outside a player, puts `data-pie-content` on
that container to give it the same styles.

Rules whose selector requires a `kds-*` or `Kds*` class, MathJax output
(`mjx-*`, `TEX-*`) or a legacy content class such as `.frac` or `.noprint` stay
document-wide. Elements portal menus and popovers holding authored markup to
`<body>`, outside the player, and an inline-dropdown's choices keep their
`kds-fraction` and MathJax glyph fixes there.

### Upgrading from a manual import

An app that already imports `@pie-players/pie-theme/components.css`, scoped or
not, keeps working unchanged. The player detects a host copy by its
`--pie-content-styles` sentinel: when one is present it installs nothing, and
when one arrives after the player installed its own, the player removes its
copy. The host's copy is then the only one in effect, in the position the host
chose.

### Taking ownership of the stylesheet

The sentinel check covers any copy the page can read. A cross-origin `<link>`
cannot be read, so a host loading the stylesheet that way declares ownership on
the root element **before** the player script runs:

```html
<html data-pie-content-styles="host"></html>
```

```ts
import "@pie-players/pie-theme/components.css"; // owned by the host
```

The player then installs nothing. If no content stylesheet turns out to be
present, it logs a one-time `console.warn` naming the missing import. Presence is
detected through `--pie-content-styles`, a sentinel `components.css` declares
with no themeable value: it is only ever checked for being non-empty, so do not
style with it. A host that owns the stylesheet declares `@pie-players/pie-theme`
in its own `package.json`, because the player inlines its copy at build time and
does not install the package.

This stylesheet holds only the shared content styles. The `--pie-*` tokens, the
`<pie-theme>` host element, and color-scheme and font-size theming are in
[`@pie-players/pie-theme`](../theme/README.md). All of it is optional for correct
rendering, since every `var(--pie-*)` in `components.css` has a fallback.

## Custom elements

- `pie-item-player`
  - Export: `@pie-players/pie-item-player`
  - Description: the player element.
- `pie-item-player-session-debugger`
  - Export: `@pie-players/pie-item-player/components/item-session-debugger-element`
  - Description: a floating, draggable panel showing the live session, the
    environment and the controller-filtered models. Set its `hosted` to the
    player's: the panel runs no controller over a hosted player's models. The
    entry installs the content stylesheet itself.

`definePieItemPlayer(tagName?)` from the root entry registers the player under
another tag. An already-registered tag is left alone, so a second copy of the
package loading into the same document leaves the first copy rendering every
item.

## Attributes

- `config`: `Object`, default `null`. Item config with `elements`, `models`
  and `markup` fields.
- `session`: `Object`, default `{ id: "", data: [] }`. The session container,
  kept live as the player writes into it; assigning a new value applies it
  ([session management](../../docs/item-player/overview.md#session-management)).
- `env`: `Object`, default `{ mode: "gather", role: "student" }`. `env.mode` is
  `gather` (the learner responds), `view` (read-only) or `evaluate` (scored
  feedback); `env.role` is `student` or `instructor`. Neither is a security
  boundary ([delivery integrity](../../docs/security/readme.md#delivery-integrity)).
- `strategy`: `String`, default `"iife"`. Loading strategy: `"iife"`, `"esm"`
  or `"preloaded"`
  ([loading strategies](../../docs/item-player/loading-strategies.md)).
- `mode`: `String`, default `"view"`. `"view"` loads delivery elements.
  `"author"` loads each element's configure element (`<tag>-config`), passes it
  the model and the resolved [`configuration`](#authoring-configuration), emits
  `model-loaded` and `model-updated`, and enables `validateModels()` and the
  [media hooks](#authoring-media-hooks).
- `authoring-backend`: `String`, default `"demo"`. `"demo"` installs demo media
  handlers; `"required"` requires the host to supply all four.
- `hosted`: `Boolean`, default `false`, or `true` when `backend.delivery` is
  enabled. A hosted player renders server-processed models and runs no element
  controller in the browser; under `iife` it loads the `player.js` bundle.
- `add-correct-response`: `Boolean`, default `false`. Populate correct
  responses into the session.
- `show-bottom-border`: `Boolean`, default `false`. Add a bottom border in
  evaluate mode.
- `render-stimulus`: `Boolean`, default `true`. Render the item's passage
  (stimulus); `false` renders the item alone.
- `allowed-resize`: `Boolean`, default `false`. Let the learner resize the
  passage container horizontally.
- `autoplay-audio-enabled`: `Boolean`, default unset, which leaves each model's
  `autoplayAudioEnabled` as it is. Set, it writes `autoplayAudioEnabled` onto
  every model in the config, overwriting or adding the field.
- `base-heading-level`: `Number` (1–6), default unset. The level of the item's
  visually hidden heading, which PIE elements emit; authored headings nest one
  level below it. Reflected, because elements read it off the player.
- `include-sr-heading`: `Boolean`, default `true`. Emit the item's visually
  hidden heading. Reflected.
- `locale`: `String`, default `""` (renders `en-US`). BCP 47 interface locale
  for the player's own UI. The item's content language is separate.
- `debug`: `String`, default `""`. Any value other than `"false"` (any case),
  `"0"` or the empty string turns on the player's debug logging. The player
  writes the result to `window.PIE_DEBUG`, the flag the page's other PIE loggers
  read, so the default writes `false`
  ([logging](../players-shared/src/pie/README.md#logging)).
- `custom-class-name`: `String`, default `""`. CSS scope class applied to the
  player container.
- `container-class`: `String`, default `""`. Extra class on the inner item
  container.
- `passage-container-class`: `String`, default `""`. Extra class on the passage
  container; `itemConfig.resources.passageContainerClass` overrides it.
- `external-style-urls`: `String`, default `""`. Comma-separated stylesheet URLs
  the player loads alongside `config.resources.stylesheets`. URLs must be
  `http:` or `https:`, and same-origin unless their origin is named in
  `allowed-style-origins`. A same-origin sheet is fetched and its selectors are
  rewritten to `.pie-item-player.<scope class>`, so it styles this player only.
- `allowed-style-origins`: `String`, default `""`. Comma-separated origin
  allow-list for `external-style-urls` and `config.resources.stylesheets[*].url`.
  Unset, only same-origin stylesheets load; set, only the listed origins load,
  so the list names the page's own origin when it serves stylesheets too. A
  cross-origin sheet cannot be read to scope it, so the player adds it as a
  `<link>` in `<head>` and its rules reach the whole page
  ([external stylesheets](../../docs/security/readme.md#external-stylesheets)).
- `loader-config`: `Object`, default below. Retry and instrumentation settings:
  - `iifeBundleRetry`: `{ retryDelayMs: 3000, timeoutMs: 120000 }`. How long the
    IIFE adapter retries a bundle the bundle host is still building, reported as
    `bundle-retry-status`.
  - `maxResourceRetries`: `3`, and `resourceRetryDelay`: `500` (ms, the first
    delay of an exponential backoff). Retries of failed images, audio and video.
  - `trackPageActions`: `false`. Report player events to the instrumentation
    provider.
  - `instrumentationProvider`: unset. The provider events go to; unset with
    `trackPageActions` on falls back to New Relic, and `null` disables
    instrumentation
    ([instrumentation providers](../../docs/architecture/instrumentation-providers.md)).
- `configuration`: `Object`, default `{}`. Settings passed to configure elements
  ([authoring configuration](#authoring-configuration)).
- `trust-markup`: `Boolean`, default `false`. Skip the built-in markup
  sanitizer ([content trust boundary](#content-trust-boundary)).
- `session-snapshot`: `Object` or `Boolean`, default off. Opt into a
  device-local copy of each committed session, offered back after a crash. It
  needs a `backend.delivery` `sessionId` or an explicit `sessionSnapshot.key`
  ([session snapshot](../../docs/item-player/overview.md#session-snapshot)).

A Boolean attribute set to `"false"`, `"0"`, `"off"` or `"no"`, in any case,
reads as `false`.

## Properties (JS only)

These are set from JavaScript; they have no attribute.

- `loaderOptions`: `{ bundleHost?: string, esmCdnUrl?: string, esmCdnProvider?: string | object, moduleResolution?: "url" | "import-map", view?: string, loadControllers?: boolean, runtimeSupportCheck?: "off" | "on", elementPackagePolicy?: { allowedPackages: string[], requireExactVersions?: boolean } }`.
  Strategy-specific loader settings, with their defaults and the ESM CDN
  providers, in [`loaderOptions`](../../docs/item-player/loading-strategies.md#loaderoptions).
  `elementPackagePolicy` limits the `config.elements` packages that may execute
  to exact names or `name@version` specs
  ([escape hatches](../../docs/security/readme.md#escape-hatches)).
- `sanitizeMarkup`: `(markup: string) => string`. Replaces the built-in
  sanitizer ([custom sanitizer](#provide-a-custom-sanitizer)). Ignored when
  `trust-markup` is set.
- `backend`: `{ delivery?, authoring? }`. Loading, saving and scoring through
  the PIE API backend
  ([backend support](../../docs/item-player/backend-support.md)). A custom
  `backend.delivery.client` forwards `context.requestOptions.keepalive` to
  `fetch`; without it the save that runs as the page unloads is an ordinary
  request the browser may drop.
- `sessionSnapshot`: `boolean | { enabled?: boolean, store?: SessionSnapshotStore, key?: string }`.
  The property form of `session-snapshot`. `store` replaces the default
  `sessionStorage` backing, and its owner owns the retention consequences.
- `onInsertImage`, `onDeleteImage`, `onInsertSound`, `onDeleteSound`: the
  [authoring media hooks](#authoring-media-hooks).

## Methods

- `provideScore(): Promise<false | Array<Record<string, unknown> | undefined>>`
  scores in the browser with the elements' controllers and returns one result
  slot per scored model, or `false` when no item is loaded. A hosted player
  runs no controllers and leaves every slot `undefined`
  ([scoring](../../docs/item-player/scoring-and-rubrics.md)).
- `validateModels(): Promise<AuthoringValidationResult>` runs each rendered
  configure element's controller `validate(model, configuration)` and returns
  `{ hasErrors, validatedModels }`. Each validated model is
  `{ ...model, errors }`, where `errors` is the controller's field → message map,
  and each configure element receives the same map as `model.errors` to render
  its inline messages. Outside author mode it returns
  `{ hasErrors: false, validatedModels: [] }`; it throws when called in author
  mode before the authoring elements have loaded.
- `loadFromBackend(scope?: "delivery" | "authoring"): Promise<void>` loads the
  configured backend's config and session into the player.
- `saveSession(): Promise<void>` saves the current session through
  `backend.delivery`.
- `score(options?: BackendScoreOptions): Promise<unknown>` scores on the server
  through `backend.delivery`.
- `saveContent(options?: BackendSaveContentOptions): Promise<string>` saves the
  current config through `backend.authoring` and resolves with the content id.
- `releaseContent(options?: BackendAuthoringReleaseOptions): Promise<string>`
  releases the content through `backend.authoring` and resolves with the
  content id.
- `commitPendingElementSessions(): void` commits every mounted element's pending
  `session-changed` now. A host that removes the player calls it first: the
  player's own destroy runs after the element is detached, so the event it
  produces does not reach `document`
  ([session commit](../../docs/item-player/overview.md#session-commit)).
- `getPendingSessionSnapshot(): SessionSnapshotRecord | null` returns the
  snapshot `session-snapshot-available` announced, for a host that attached its
  listener after the event fired.

A backend method rejects its promise on failure and dispatches no
`backend-error`.

## Events

- `load-complete`: the PIE elements have loaded and rendered, and the math in
  the item's own markup is typeset, which the player waits for at most two
  seconds
  ([load completion](../../docs/item-player/loading-strategies.md#load-completion)).
- `session-changed`: an element's session or completion changed. An element's
  announcement is forwarded when its `complete` or its session differs from
  what that element last announced, so each element reaches the host once at
  load and one response produces one event. The detail has one of two shapes:
  - `{ complete, component, elementId, session: { id, data } }` when the item
    session changed. `session` is the whole item session.
  - `{ complete, component, elementId, session: null, intent: "metadata-only" }`
    when only metadata changed.

  `complete` is the announcing element's own, `component` its tag and
  `elementId` its model id. Every event carries `complete` and `component`:
  where the element supplied neither (an event synthesized for an element that
  cannot commit itself, or correct responses the player populated), `component`
  is the element's tag and `complete` is whether its session record holds a
  response. State an element's controller writes into the session, such as a
  shuffled choice order, dispatches no event of its own: the `session`
  container holds it at once, and the next event carries it.

  Focus leaving the player delivers any pending announcement at once, ahead of
  the click or key that moved focus. A commit at a teardown, navigation or
  page-hidden seam has the first shape plus `sessionCommitReason`
  (`"teardown" | "navigate" | "page-hidden"`). A host that re-pushes `config`
  in response to this event ignores a commit: the commit reports a response the
  host is about to lose and asks for no reload
  ([session commit](../../docs/item-player/overview.md#session-commit)).
- `player-error`: `PieItemPlayerErrorDetail`,
  `{ code, message, recoverable, stage?, strategy?, mode?, cause? }`, for
  example `AUTHORING_BACKEND_CONFIG_ERROR` or `ITEM_PLAYER_LOAD_ERROR`.
  `recoverable` is `true` when the item stays usable: a failed update leaves it
  as it was, and a failed controller falls back to the authored model
  (`ITEM_PLAYER_UPDATE_ERROR`, `PIE_CONTROLLER_RUNTIME_ERROR`,
  `PIE_CONTROLLER_CONTRACT_ERROR`). It is `false` when the player has no item
  to show, so a host can treat the error as fatal on `recoverable` alone. When
  elements fail to register, `cause` names each one and why, such as the module
  URL that failed to load; the error is reported as soon as every missing
  element's load has failed.
- `bundle-retry-status`:
  `{ state, url, attempt, elapsedMs, timeoutMs, retryDelayMs?, reason? }`, with
  `state` one of `"retrying"`, `"completed"`, `"timeout"` or `"cancelled"`. The
  IIFE adapter is retrying a bundle the bundle host is still building, under
  `loader-config`'s `iifeBundleRetry`; the player shows a "still building"
  message meanwhile.
- `model-updated`: `{ update, reset }`, author mode. A configure element changed
  its model; `update` is that model, with its `id`. The player applies it to
  its own copy of the config and leaves the host's object as it was: a host
  that keeps the config merges `update` into the model with the same `id`,
  replacing the model when `reset` is true.
- `model-loaded`: `{ models, configuration }`, author mode. Emitted once per
  renderer initialization, after the configure elements receive their models
  and configuration.
- `correct-responses-populated`:
  `{ itemId?, mode?, role?, bundleType?, populatedCount, elements }`. Correct
  responses were written into the session. `elements` holds the
  `config.models[].element` names (for example
  `multiple-choice--version-latest`), and the detail carries no session
  entries. It lets a host detect a population it did not ask for. Population
  needs an element controller in the browser, which a player that is not hosted
  gets from a `client-player.js` bundle under `iife`, from the controller
  modules `esm` loads, or from a controller registered with
  `registerPreloadedElements`. Preventing it takes a hosted player
  ([delivery integrity](../../docs/security/readme.md#delivery-integrity)).
  It is also forwarded to a configured instrumentation provider as
  `pie-item-correct-responses-populated`, the only item-player event on that
  bridge: forwarding `session-changed`, which carries learner responses, to
  telemetry is the host's decision.
- `session-snapshot-available`: `{ key, session, timestamp }`. On load, with
  `session-snapshot` enabled, device storage holds a snapshot for this sitting.
  The player never applies it; the host decides.
- `backend-load-complete`: `{ scope, operation: "load", metadata, ... }`.
  `backend.delivery` loaded the item, with `session` in the detail, or
  `backend.authoring` loaded content, with `contentId` and `config`.
- `backend-model-complete`: `{ scope: "delivery", operation: "model", metadata }`.
  The backend returned refreshed models for a hosted player.
- `backend-session-saved`: `{ scope, operation, sessionId, session }`.
  `saveSession()` or an autosave succeeded.
- `backend-score-complete`: `{ scope, operation: "score", sessionId, score }`.
  `score()` succeeded.
- `backend-content-saved`, `backend-content-released`:
  `{ scope: "authoring", operation, contentId }`. `saveContent()` or
  `releaseContent()` succeeded.
- `backend-error`: `{ scope: "delivery", operation, message, error }`, with
  `operation` one of `"load"`, `"model"` or `"saveSession"`. An automatic
  delivery load, model refresh or autosave failed.

## Backend delivery

`backend.delivery` loads the item and session from the PIE API backend,
autosaves, and scores on the server; `backend.authoring` loads, saves and
releases authored content. [Backend support](../../docs/item-player/backend-support.md)
covers both, with a runnable local demo.

## PIE element packaging contract

`strategy="esm"` and `strategy="preloaded"` load what an element package
publishes under the
[PIE element contract](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/PIE_ELEMENT_CONTRACT.md)
in pie-elements-ng. [Loading strategies](../../docs/item-player/loading-strategies.md)
covers how the player consumes it: the static browser ESM files, the exact
shared dependencies, the shared editor runtime, the `runtime-support` check, and
registering npm-installed elements with `registerPreloadedElements`.

## Authoring configuration

In `mode="author"`, `<pie-item-player>` loads the configure elements and passes
each one a resolved `configuration` object.

Delivery and shared settings sit at the top level of `configuration`, keyed by
package spec, package name or element tag. Authoring-only settings belong under
`configuration.authoring`, so they do not affect delivery mode. Authoring keys
resolve by specificity:

1. Full versioned PIE tag, for example `multiple-choice--version-14-0-3`
2. Package spec, for example `@pie-element/multiple-choice@14.0.3`
3. Package name, for example `@pie-element/multiple-choice`
4. Package base name, for example `multiple-choice`

The top-level settings are merged first, then the matching
`configuration.authoring` settings override them, in author mode only.

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
```

## Authoring media hooks

In `mode="author"`, the player handles image and sound upload and deletion
through four handler properties:

- `onInsertImage(handler: ImageHandler): void`
- `onDeleteImage(src: string, done: (err?: Error) => void): void`
- `onInsertSound(handler: SoundHandler): void`
- `onDeleteSound(src: string, done: (err?: Error) => void): void`

`authoring-backend="demo"` installs demo handlers until the host supplies any
handler; from then on only the supplied handlers run, so a host supplies all four
or none. `authoring-backend="required"` requires all four; a missing handler
blocks the authoring UI and emits a `player-error` with code
`AUTHORING_BACKEND_CONFIG_ERROR`.

```ts
const el = document.querySelector("pie-item-player");
el.mode = "author";
el.authoringBackend = "required";

el.onInsertImage = (handler) => {
  handler.done(undefined, "https://example.com/uploaded-image.png");
};
el.onDeleteImage = (_src, done) => done();
el.onInsertSound = (handler) => {
  handler.done(undefined, "https://example.com/uploaded-sound.mp3");
};
el.onDeleteSound = (_src, done) => done();
```

## Exports

| Entry | Exports |
| --- | --- |
| `@pie-players/pie-item-player` | Registers `<pie-item-player>` and installs the content stylesheet at import. Exports `definePieItemPlayer(tagName?)`, `ensureItemPlayerMathRenderingReady()` and the types below |
| `@pie-players/pie-item-player/preloaded` | `registerPreloadedElements`, `ensureItemPlayerMathRenderingReady()`, and the types `PreloadedElement`, `PreloadedController`, `PreloadedRegistrationOptions` and `MathAssetOptions`. Defines no element and installs no stylesheet |
| `@pie-players/pie-item-player/components/item-session-debugger-element` | Registers `<pie-item-player-session-debugger>` |

`ensureItemPlayerMathRenderingReady()` installs the math renderer IIFE element
bundles read from `window`, unless the page holds one. The player calls it
before loading IIFE bundles; a host that loads IIFE element bundles itself calls
it first ([math rendering](../../docs/item-player/math-rendering.md)).

```ts
import type {
  PieItemPlayerElement,
  PieItemSessionDebuggerElement,
  PieItemPlayerLoaderOptions,
  PieItemPlayerErrorDetail,
  AuthoringBackendMode,
  AuthoringValidationResult,
  ImageHandler,
  SoundHandler,
  DeleteDone,
  BackendConfig,
  BackendDeliveryConfig,
  BackendAuthoringConfig,
} from "@pie-players/pie-item-player";
```

The root entry also exports every type in
[`src/backend/types.ts`](./src/backend/types.ts): the endpoint, identity,
request, context, client and result types `BackendConfig` is built from.

## Content trust boundary

`<pie-item-player>` renders the `markup` of `config`, and of an attached
passage, through a default-on sanitizer built on
[DOMPurify](https://github.com/cure53/DOMPurify). It keeps `pie-*` tags and the
item's own element tags, and its guarantees are in the
[security model](../../docs/security/readme.md#sanitizer-guarantees).

The player renders into light DOM, which does not contain authored CSS
([light DOM](../../docs/security/readme.md#light-dom-and-the-absence-of-containment)),
so an authored `position: absolute` overlay can paint over the host page. That
residual is accepted by design
([accepted residual](../../docs/security/readme.md#accepted-residual-absolute-positioned-overlays)).
What the deployment must set, from `allowed-style-origins` to a
Content-Security-Policy, is in
[host obligations](../../docs/security/readme.md#host-obligations).

### Reflow wrappers

After sanitizing, the player wraps every authored `<img>` and `<table>` outside
a `pie-*` element in a horizontally scrollable region, so content wider than
its column scrolls instead of being clipped by an `overflow-x: hidden` ancestor
(WCAG 1.4.10 Reflow at 400% zoom). Images get
`<span class="pie-image-scroll">`, plus `pie-image-scroll-block` when the image
is laid out as a block; tables get `<div class="pie-table-scroll">`. Each
wrapper is keyboard-scrollable (`tabindex="0"`, `role="region"`) and takes its
`aria-label` from the image's `alt`, or from the table's `aria-label`,
`aria-labelledby` or `<caption>`. A post-render pass wraps the images and
tables an element paints into its own light DOM the same way. The wrapper CSS
is part of the [content styles](#content-styles).

### Opt out (trusted content)

A host that already validates item markup, such as an authoring pipeline that
renders only markup its own servers produced, disables sanitization:

```html
<pie-item-player trust-markup config='...' session='...'></pie-item-player>
```

```ts
el.trustMarkup = true;
```

### Provide a custom sanitizer

`sanitizeMarkup` replaces the built-in sanitizer, to extend its allow-list or to
apply a stricter one. The function receives the markup only, without the
allow-list of the item's element tags the default builds, so it allow-lists them
itself. The player has rewritten the markup's tags to versioned tags by then
(`multiple-choice--version-14-0-3`), and to `<tag>-config` in author mode:

```ts
import { sanitizeItemMarkup } from "@pie-players/pie-players-shared/security";
import { parseVersionedTagName } from "@pie-players/pie-players-shared/pie/tag-names";

const itemElements = new Set(Object.keys(config.elements));
const TAG = /<([a-z][\w.-]*)/gi;

el.sanitizeMarkup = (markup: string) => {
  const itemTags = [...markup.matchAll(TAG)]
    .map(([, tag]) => tag.toLowerCase())
    .filter((tag) =>
      itemElements.has(parseVersionedTagName(tag.replace(/-config$/, "")).baseName),
    );
  return sanitizeItemMarkup(markup, {
    allowedCustomElements: [...itemTags, "my-custom-widget"],
  });
};
```

When `trust-markup` is set, `sanitizeMarkup` is ignored. A custom sanitizer owns
every guarantee the default gives
([escape hatches](../../docs/security/readme.md#escape-hatches)).

## Further reading

- [Item player architecture](../../docs/item-player/overview.md)
- [Loading strategies](../../docs/item-player/loading-strategies.md)
- [Math rendering](../../docs/item-player/math-rendering.md)
- [Backend support](../../docs/item-player/backend-support.md)
- [Scoring and rubrics](../../docs/item-player/scoring-and-rubrics.md)
- [Preloaded player](../../docs/preloaded-player/readme.md)
- [Migration from the legacy PIE players](../../docs/item-player/migration-from-pie-player-components.md)
