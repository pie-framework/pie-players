---
"@pie-players/pie-players-shared": patch
---

The shared item renderer no longer dispatches its events on `window`.

`dispatch()` in `players-shared`'s `PieItemPlayer` fired a DOM event alongside
each callback, and the call was a bare `dispatchEvent(event)` with no local
binding — which resolves to `window.dispatchEvent`. Every public event the
renderer emitted therefore fired on `window`: `load-complete`, `player-error`,
`model-updated`, `model-loaded`, and `session-changed`, whose detail carries the
learner's responses. Any script sharing the host page — an analytics tag, a
browser extension content script — could read every item's responses off
`window`, with no way to attribute them to a player instance and no host opt-in.

`<pie-item-player>` already owned DOM emission for all five events through
`handlePlayerEvent`, which dispatches from the host element with
`bubbles: true, composed: true`. The window dispatch was duplicate reach rather
than the only route, so it is removed and the callback props are the whole path.

Host-facing behaviour is unchanged for element-level and `document`-level
listeners, which is every route recorded in
`docs/integrations/consumer-api-dependencies.md` and every listener in this
repository. A host that listened on `window` for these five names stops
receiving them and should listen on the `<pie-item-player>` element or at
`document` instead.

`PiePreviewLayout` gains the `onModelLoaded` pass-through it was missing. It
already forwarded the other four callbacks, so `model-loaded` had been reaching
its consumers only through the window dispatch; without this it would have been
dropped.
