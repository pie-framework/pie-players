# pie-item-player

Unified PIE item player custom element with strategy-based loading.

## Strategies

- `iife`: load from bundle host
- `esm`: load from ESM CDN
- `preloaded`: assume host preloaded elements

## Authoring Media Backend Hooks

`pie-item-player` supports optional media backend hooks for author mode (`mode="author"`):

- `onInsertImage(handler)`
- `onDeleteImage(src, done)`
- `onInsertSound(handler)`
- `onDeleteSound(src, done)`

Configure policy with `authoringBackend`:

- `demo` (default): demo-only, non-production media behavior.
- `required`: all four handlers are required in author mode.

### Failure behavior

- Backend validation runs only in author mode.
- In `required` mode, missing handlers block authoring UI and raise `player-error`.
- If configured handlers throw/fail, the error is surfaced and logged; no fallback to demo/default behavior is applied.

### Minimal integration example

```ts
const el = document.querySelector("pie-item-player");
el.mode = "author";
el.authoringBackend = "required";

el.onInsertImage = (handler) => {
  console.log("[backend] insert image");
  handler.done(undefined, "https://example.invalid/image.png");
};
el.onDeleteImage = (_src, done) => done();
el.onInsertSound = (handler) => {
  console.log("[backend] insert sound");
  handler.done(undefined, "https://example.invalid/sound.mp3");
};
el.onDeleteSound = (_src, done) => done();
```
