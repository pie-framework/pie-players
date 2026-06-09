# @pie-players/pie-item-player

Unified custom element for rendering PIE assessment items. A single `<pie-item-player>` tag handles delivery, evaluation, and authoring through a `mode` attribute, and supports multiple loading strategies (`iife`, `esm`, `preloaded`).

This package replaces the legacy `@pie-framework/pie-player-components` project, which required separate `<pie-player>` and `<pie-author>` elements. See [migration guide](../../docs/item-player/migration-from-pie-player-components.md) for details.

## Install

```bash
npm install @pie-players/pie-item-player
# or
bun add @pie-players/pie-item-player
```

Or load from a CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@pie-players/pie-item-player/dist/pie-item-player.js"></script>
```

The script self-registers the `<pie-item-player>` custom element.

## Runtime boundary and migration

- Browser-only package: `@pie-players/pie-item-player` is a DOM custom-element
  runtime package and is not intended for plain Node runtime imports.
- Node-import-safe packages (for server/runtime utilities) are documented in
  `docs/setup/library-packaging-strategy.md`.
- Migration direction:
  - Legacy migration from `@pie-framework/pie-player-components` remains documented.
  - For current hosts, prefer the stable default entrypoint:

```ts
import "@pie-players/pie-item-player";
```

Use explicit component subpath exports only when you need targeted registration
control (for example the session debugger element export).

Standalone browser variants for this package are intentionally deferred; current
support targets default bundler entrypoints under `dist`.

## Quick start

```html
<pie-item-player
  strategy="iife"
  config='{"elements":{"my-el":"my-el@1.0.0"},"models":[{"id":"1","element":"my-el"}],"markup":"<my-el id=\"1\"></my-el>"}'
  env='{"mode":"gather","role":"student"}'
  session='{"id":"s1","data":[]}'
></pie-item-player>
```

## Custom elements

- `pie-item-player`
  - Export: `@pie-players/pie-item-player`
  - Description: main player element
- `pie-item-player-session-debugger`
  - Export: `@pie-players/pie-item-player/components/item-session-debugger-element`
  - Description: floating debug panel showing live session and filtered model data

## Attributes

- `config`: `Object`, default `null`. Item config with `elements`, `models`,
  and `markup` fields.
- `session`: `Object`, default `{ id: "", data: [] }`. Session container.
- `env`: `Object`, default `{ mode: "gather", role: "student" }`.
  Environment mode and role.
- `strategy`: `String`, default `"iife"`. Loading strategy: `"iife"`,
  `"esm"`, or `"preloaded"`.
- `mode`: `String`, default `"view"`. Player mode: `"view"` or `"author"`.
- `authoring-backend`: `String`, default `"demo"`. `"demo"` uses built-in
  stubs; `"required"` requires host-provided handlers.
- `hosted`: `Boolean`, default `false`. Whether running in hosted mode; affects
  IIFE bundle type.
- `add-correct-response`: `Boolean`, default `false`. Populate correct
  responses on models.
- `show-bottom-border`: `Boolean`, default `false`. Add bottom border in
  evaluate mode.
- `debug`: `String`, default `""`. Truthy values enable verbose logs;
  `"false"`, `"0"`, and `""` disable them. Also reads `window.PIE_DEBUG`.
- `custom-class-name`: `String`, default `""`. CSS scope class applied to the
  player container.
- `container-class`: `String`, default `""`. Extra class on the inner item
  container.
- `external-style-urls`: `String`, default `""`. Comma-separated CSS URLs
  loaded and scoped to the player. URLs must be `http:` or `https:`.
- `allowed-style-origins`: `String`, default `""`. Optional comma-separated
  origin allow-list. When set, `external-style-urls` and
  `itemConfig.resources.stylesheets[*].url` are rejected if their origin is not
  on the list.
- `loader-config`: `Object`, default package config. Loader instrumentation
  config.
- `configuration`: `Object`, default `{}`. Authoring configuration settings.
  Use `configuration.authoring` for authoring-only settings.
- `trust-markup`: `Boolean`, default `false`. Skip the built-in markup
  sanitizer. See [Content trust boundary](#content-trust-boundary).

## Properties (JS only)

These are set via JavaScript, not HTML attributes.

- `loaderOptions`: `{ bundleHost?: string, esmCdnUrl?: string, esmCdnProvider?: string | object, moduleResolution?: "url" | "import-map", view?: string, loadControllers?: boolean, runtimeSupportCheck?: "off" | "on" }`.
  Strategy-specific loader options. For ESM, the default provider is jsDelivr
  (`https://cdn.jsdelivr.net/npm`); use `esmCdnProvider: "esm.sh"` with
  `esmCdnUrl: "https://esm.sh"` for esm.sh, or pass a provider object when
  package artifacts and shared dependencies use custom routes.
- `sanitizeMarkup`: `(markup: string) => string`. Replace the built-in
  DOMPurify sanitizer with a host-supplied function. Ignored when
  `trust-markup` is set.
- `backend`: JS-only backend integration namespace. Use `backend.delivery` for
  API-backed item/session load, autosave, explicit save, and server scoring.
  Existing player inputs such as `env`, `strategy`, `loaderOptions`, `config`,
  and `session` remain top-level player properties.

## Methods

- `provideScore(): Promise<false | Array<Record<string, unknown> | undefined>>`
  returns one result slot per scored model for legacy-compatible local browser
  scoring.
- `updateElementModel(update): Promise<void>` applies a legacy-compatible
  preview update for a single loaded PIE model.
- `validateModels(): Promise<AuthoringValidationResult>` runs authoring-mode
  validation for rendered configure elements and returns
  `{ hasErrors, validatedModels }`.
- `loadFromBackend(scope?: "delivery" | "authoring"): Promise<void>` loads
  configured backend data into the existing player config/session pipeline.
- `saveSession(): Promise<void>` persists the current session through
  `backend.delivery`.
- `score(options?): Promise<unknown>` performs server-backed scoring through
  `backend.delivery`. This is intentionally separate from local
  `provideScore()`.

## Events

- `load-complete`: emitted when PIE elements finish loading.
- `session-changed`: `{ session, ... }`. Emitted when the student interacts and
  session data changes.
- `player-error`: `{ code?, message?, stage?, strategy?, mode? }`. Error event,
  for example `AUTHORING_BACKEND_CONFIG_ERROR` or `ITEM_PLAYER_LOAD_ERROR`.
- `model-updated`: emitted when a PIE element model is updated.
- `model-loaded`: `{ models, configuration }`. Authoring lifecycle event
  emitted once per renderer initialization after configure elements receive
  models and configuration.
- `backend-load-complete`: emitted after `backend.delivery` loads config/session
  data.
- `backend-session-saved`: emitted after `saveSession()` or delivery autosave
  persists successfully.
- `backend-score-complete`: emitted after server-backed `score()` completes.
- `backend-error`: emitted when backend load/save/score fails.

## Backend delivery

Backend support is a JS-only namespace for networking and persistence. It does
not duplicate existing delivery inputs such as `env`, `strategy`,
`loaderOptions`, `bundleEndpoints`, or styling props.

```ts
const el = document.querySelector("pie-item-player");
el.env = { mode: "gather", role: "student" };
el.strategy = "iife";
el.loaderOptions = { bundleHost: "https://proxy.pie-api.com/bundles/" };
el.backend = {
  delivery: {
    enabled: true,
    provider: "pie-api",
    itemId: "item-1",
    sessionId: "session-1",
    autosave: { enabled: true, debounceMs: 250 },
    endpoints: {
      load: "/api/player/load",
      saveSession: "/api/player/save",
      model: "/api/player/model",
      score: "/api/player/score",
    },
  },
};
```

For a runnable local backend demo, see
[`docs/item-player/backend-support.md`](../../docs/item-player/backend-support.md).

## PIE Element Packaging Contract

The canonical producer-side contract for `@pie-element/*` packages lives in the
`pie-elements-ng` package contract.
`<pie-item-player strategy="esm">` assumes that contract is satisfied:

- Element packages publish static browser ESM files such as
  `dist/browser/delivery/index.js`, `dist/browser/author/index.js`, and
  `dist/browser/controller/index.js`. The player imports those files directly;
  it does not transform element package entrypoints through CDN `+esm` routes.
- React-backed browser ESM packages declare exact shared browser singleton
  versions in `package.json` under `pie.browserSharedDependencies`; dependency
  and peer-dependency ranges are not used as fallback runtime contracts.
- `./runtime-support` metadata is optional for ESM-capable packages unless they
  need to disable a runtime strategy or view. Set
  `loaderOptions.runtimeSupportCheck = "on"` when you want the player to read
  those hints before loading.
- `strategy="preloaded"` is not a separate package shape. It means the host has
  already registered the versioned custom element tag before the player renders.

## Authoring configuration

When `mode="author"`, `<pie-item-player>` loads editor/config elements and
passes each configure element a resolved `configuration` object.

Delivery/shared settings stay at the top level of `configuration` and may be
keyed by package spec, package name, or element tag. Authoring-only settings
belong under `configuration.authoring` so they do not affect delivery mode.
Authoring keys resolve by specificity:

1. Full versioned PIE tag, for example `multiple-choice--version-1-2-3`
2. Package spec, for example `@pie-element/multiple-choice@1.2.3`
3. Package name, for example `@pie-element/multiple-choice`
4. Package base name, for example `multiple-choice`

Top-level delivery/shared settings are merged first, then matching
`configuration.authoring` settings override them for authoring only.

```ts
const el = document.querySelector("pie-item-player");
el.mode = "author";
el.configuration = {
  "@pie-element/multiple-choice@1.2.3": {
    sharedSetting: true,
  },
  authoring: {
    "multiple-choice--version-1-2-3": {
      authoringOnlySetting: true,
    },
  },
};
```

## Authoring media hooks

When `mode="author"`, the player supports image and sound upload/delete through four handler properties:

- `onInsertImage(handler: ImageHandler): void`
- `onDeleteImage(src: string, done: (err?: Error) => void): void`
- `onInsertSound(handler: SoundHandler): void`
- `onDeleteSound(src: string, done: (err?: Error) => void): void`

With `authoring-backend="demo"`, built-in demo handlers are used. Set `authoring-backend="required"` to enforce that the host provides all four handlers; missing handlers will block the authoring UI and emit a `player-error`.

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

## Exported types

```ts
import type {
  PieItemPlayerElement,
  PieItemSessionDebuggerElement,
  AuthoringBackendMode,
  ImageHandler,
  SoundHandler,
  DeleteDone,
  AuthoringValidationResult,
} from "@pie-players/pie-item-player";
```

## Content trust boundary

`<pie-item-player>` injects the `markup` field from the supplied `config`
(and from `passageConfig.markup` when a passage is attached) into the DOM
via Svelte's `{@html}` directive. To avoid XSS when hosts embed
attacker-influenced item/passage JSON (preview surfaces, multi-tenant
authoring, etc.) the player now ships with a **default-on** markup
sanitizer powered by [DOMPurify](https://github.com/cure53/DOMPurify). The
sanitizer:

- Strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<base>`, `<form>`,
  `<meta>`, `<link>`, and any event-handler attributes (`onerror`,
  `onload`, ...).
- Rejects unknown URL protocols (`javascript:`, `data:` unless explicitly
  marked safe).
- Preserves the PIE custom-element contract: any tag matching `pie-*` and
  the attribute families `data-*`, `aria-*`, `pie-*`, `model-*`,
  `session-*`, `config-*`, `context-*` pass through unchanged. Third-party
  custom elements must be registered via the `sanitizeMarkup` property.

### Opt out (trusted content)

Hosts that already validate item markup (for example, content-authoring
pipelines that only ever render markup produced by their own trusted
servers) can disable sanitization:

```html
<pie-item-player trust-markup config='...' session='...'></pie-item-player>
```

```ts
el.trustMarkup = true;
```

### Provide a custom sanitizer

To extend the allow-list (or use a stricter sanitizer) set
`sanitizeMarkup` on the element:

```ts
import { sanitizeItemMarkup } from "@pie-players/pie-players-shared/security";

el.sanitizeMarkup = (markup: string) =>
  sanitizeItemMarkup(markup, {
    allowedCustomElements: ["my-custom-widget"],
  });
```

When `trust-markup` is set, `sanitizeMarkup` is ignored.

## Further reading

- [Item Player overview](../../docs/item-player/overview.md)
- [Loading strategies](../../docs/item-player/loading-strategies.md)
- [Migration from pie-player-components](../../docs/item-player/migration-from-pie-player-components.md)
