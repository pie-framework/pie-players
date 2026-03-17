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

| Tag | Export | Description |
|-----|--------|-------------|
| `pie-item-player` | `@pie-players/pie-item-player` | Main player element |
| `pie-item-player-session-debugger` | `@pie-players/pie-item-player/components/item-session-debugger-element` | Floating debug panel showing live session and filtered model data |

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `config` | `Object` | `null` | Item config with `elements`, `models`, and `markup` fields |
| `session` | `Object` | `{ id: "", data: [] }` | Session container |
| `env` | `Object` | `{ mode: "gather", role: "student" }` | Environment (mode + role) |
| `strategy` | `String` | `"iife"` | Loading strategy: `"iife"`, `"esm"`, or `"preloaded"` |
| `mode` | `String` | `"view"` | Player mode: `"view"` or `"author"` |
| `authoring-backend` | `String` | `"demo"` | `"demo"` (built-in stubs) or `"required"` (host must provide handlers) |
| `hosted` | `Boolean` | `false` | Whether running in hosted mode (affects IIFE bundle type) |
| `add-correct-response` | `Boolean` | `false` | Populate correct responses on models |
| `show-bottom-border` | `Boolean` | `false` | Add bottom border in evaluate mode |
| `debug` | `String` | `""` | Enable debug logging (also reads `window.PIE_DEBUG`) |
| `custom-class-name` | `String` | `""` | CSS scope class applied to the player container |
| `container-class` | `String` | `""` | Extra class on the inner item container |
| `external-style-urls` | `String` | `""` | Comma-separated CSS URLs loaded and scoped to the player |
| `loader-config` | `Object` | (default) | Loader instrumentation config |
| `configuration` | `Object` | `{}` | Authoring configuration settings |

## Properties (JS only)

These are set via JavaScript, not HTML attributes.

| Property | Type | Description |
|----------|------|-------------|
| `loaderOptions` | `{ bundleHost?: string, esmCdnUrl?: string, view?: string, loadControllers?: boolean }` | Strategy-specific loader options |

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| `load-complete` | payload | Emitted when PIE elements finish loading |
| `session-changed` | `{ session, ... }` | Emitted when the student interacts and session data changes |
| `player-error` | `{ code?, message? }` | Error (e.g. `AUTHORING_BACKEND_CONFIG_ERROR`) |
| `model-updated` | payload | Emitted when a PIE element model is updated |

## Authoring media hooks

When `mode="author"`, the player supports image and sound upload/delete through four handler properties:

| Property | Signature |
|----------|-----------|
| `onInsertImage` | `(handler: ImageHandler) => void` |
| `onDeleteImage` | `(src: string, done: (err?: Error) => void) => void` |
| `onInsertSound` | `(handler: SoundHandler) => void` |
| `onDeleteSound` | `(src: string, done: (err?: Error) => void) => void` |

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
} from "@pie-players/pie-item-player";
```

## Further reading

- [Item Player overview](../../docs/item-player/overview.md)
- [Loading strategies](../../docs/item-player/loading-strategies.md)
- [Migration from pie-player-components](../../docs/item-player/migration-from-pie-player-components.md)
