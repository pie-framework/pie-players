# pie-item-player source

A source-directory note for contributors to `@pie-players/pie-item-player`. The
[package README](../README.md) is the integration reference, and
[Loading strategies](../../../docs/item-player/loading-strategies.md) covers the
`iife`, `esm` and `preloaded` strategies.

## Layout

| Path | Contents |
| --- | --- |
| `pie-item-player.ts` | Package entry: `definePieItemPlayer`, which registers `<pie-item-player>` through the guarded define, and the content stylesheet install. |
| `PieItemPlayer.svelte` | The element. It loads elements per strategy and renders through the shared `PieItemPlayer` component in `packages/players-shared/src/components`, which the build bundles. |
| `preloaded.ts` | The `./preloaded` entry: `registerPreloadedElements` and `ensureItemPlayerMathRenderingReady`, with no element defined and no stylesheet installed. |
| `preloaded-controllers.ts` | Detects preloaded tags registered without a controller. |
| `runtime-support-check.ts` | Decides when the `esm` strategy probes a package's runtime-support metadata. |
| `math-rendering-ready.ts` | Installs the math renderer IIFE element bundles read on `window`. |
| `session-forwarding.ts` | Normalizes element session changes into the player's `session-changed` events. |
| `backend/` | Backend delivery and authoring: the orchestrator state machine, delivery and authoring flows, model refresh, and the built-in PIE API client, loaded on demand. |
| `ItemSessionDebugger.svelte`, `components/` | `<pie-item-player-session-debugger>` and its `./components/item-session-debugger-element` entry. |
| `contracts/public-events.ts` | Public event names. |
| `utils/` | Key-stable stringify, scoped external stylesheets, the autoplay-audio override. |
| `types.ts` | Re-exported public types. |

## Authoring media hooks

The package README's
[Authoring media hooks](../README.md#authoring-media-hooks) section documents the
four handlers and `authoring-backend`. The behavior lives in the shared
`PieItemPlayer` component in `packages/players-shared/src/components`, and runs
only in `mode="author"`:

- Under `demo`, supplying any handler turns the demo handlers off for all four.
- Under `required`, a missing handler blocks the authoring UI and reports
  `AUTHORING_BACKEND_CONFIG_ERROR` through `player-error`.
- A handler that throws is logged and its error passed to the element's `done`
  callback; there is no fallback to the demo handlers.
