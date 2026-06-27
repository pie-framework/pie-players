# Backend Support

`<pie-item-player>` remains a config/session/env-driven rendering element. The
backend API is a JS-only namespace for loading and persisting those same inputs,
not a replacement for existing delivery props.

## Shape

```ts
const player = document.querySelector("pie-item-player");

player.env = { mode: "gather", role: "student" };
player.strategy = "iife";
player.loaderOptions = {
  bundleHost: "https://proxy.pie-api.com/bundles/",
};

player.backend = {
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

Existing delivery inputs stay where they are: `env`, `strategy`,
`loaderOptions`, `bundleEndpoints`, `renderStimulus`, styling props, `config`,
and `session` are not duplicated under `backend.delivery`.

## Delivery Contract

When `backend.delivery.enabled` is true, the player can load item config and
session data from the configured backend:

```ts
await player.loadFromBackend("delivery");
```

The loaded config/session flow through the existing renderer pipeline. Hosts can
still set `config` and `session` directly when they do not want backend loading.
When `backend.delivery` has a load signature, `<pie-item-player>` also
auto-loads on configuration changes. Hosts can still call
`loadFromBackend("delivery")` explicitly for imperative flows.

Backend session persistence is explicit:

```ts
await player.saveSession();
```

Autosave is opt-in through `backend.delivery.autosave`. Autosave listens to the
same normalized `session-changed` event the player already emits.

Server scoring is separate from local browser scoring:

```ts
const serverScore = await player.score();
const localOutcomes = await player.provideScore();
```

Do not treat these as interchangeable. `provideScore()` calls loaded controllers
in the browser and returns per-model outcomes. `score()` delegates to the
configured backend and returns whatever the backend's scoring contract returns.

## Why Model And Score Belong On The Backend

In production and other non-trivial deployments, backend delivery does more than
fetch stored JSON. Item config stored in a database can include authoring data,
including correct responses. Student-facing clients should receive the result of
running those raw models through PIE controller `model()` functions, not the raw
stored models themselves. The controller can filter or transform fields based on
`env.mode` and `env.role` before the browser renders the item.

Scoring has the same boundary. Controller `outcome()` contains the logic for
scoring a response, and student clients should not need that scoring
implementation in the browser. A backend `score()` endpoint lets the player
submit session data and receive outcomes without exposing the scoring function
as part of student delivery.

## Section-player Runtime Configuration

Hosts that render items through `<pie-section-player-splitpane>` or
`<pie-section-player-vertical>` should configure delivery once on
`runtime.player`. Section-player derives a concrete item-player `backend` prop
for each embedded item.

```ts
sectionPlayer.runtime = {
  playerType: "iife",
  player: {
    backend: {
      delivery: {
        enabled: true,
        baseUrl: bffUrl,
        assignmentId: playerSessionId,
        endpoints: {
          load: "/api/player/load",
          saveSession: "/api/player/save",
          model: "/api/player/model",
          score: "/api/player/score",
        },
      },
    },
  },
};
```

Section-player treats `backend.delivery.itemId` and `sessionId` as per-item
delivery identity. It derives them from `canonicalItemId || item.id` and the
item session before forwarding `backend` to each embedded item player. Static
delivery fields such as `baseUrl`, `auth`, `endpoints`, `assignmentId`, and
`autosave` are preserved. Use `assignmentId` for shared attempt/player identity.
Use `runtime.player.resolveBackend` only when the backend needs custom per-item
identity mapping.

Nested item players auto-load from the derived `backend.delivery` config. Hosts
should not query nested item players and call `loadFromBackend()` one by one.
Passage players do not receive item delivery backend config, but shared
non-delivery backend config is preserved.

This item delivery backend is distinct from the section-player element-loader
backend used for IIFE/ESM bundle preloading.

## Endpoint Payloads

The built-in `pie-api` client sends JSON requests with these shapes.

Load:

```json
{
  "itemId": "item-1",
  "sessionId": "item-session-1",
  "assignmentId": "attempt-1",
  "env": { "mode": "gather", "role": "student" }
}
```

The load response must include an item config under `config`, `item`, or
`item.config`, plus an optional session:

```json
{
  "item": {
    "markup": "<multiple-choice id=\"q1\"></multiple-choice>",
    "elements": {
      "multiple-choice": "@pie-element/multiple-choice@1.2.3"
    },
    "models": [
      { "id": "q1", "element": "multiple-choice", "prompt": "Pick one" }
    ]
  },
  "session": { "id": "item-session-1", "data": [] },
  "metadata": { "source": "quiz-engine-bff" }
}
```

Save session:

```json
{
  "sessionId": "item-session-1",
  "data": [
    {
      "id": "q1",
      "element": "multiple-choice--version-1-2-3",
      "value": ["a"]
    }
  ],
  "env": { "mode": "gather", "role": "student" },
  "itemId": "item-1",
  "assignmentId": "attempt-1"
}
```

Model refresh:

```json
{
  "sessionId": "item-session-1",
  "data": [],
  "env": { "mode": "gather", "role": "student" },
  "itemId": "item-1",
  "assignmentId": "attempt-1"
}
```

Score:

```json
{
  "sessionId": "item-session-1",
  "data": [
    {
      "id": "q1",
      "element": "multiple-choice--version-1-2-3",
      "value": ["a"]
    }
  ],
  "env": { "mode": "gather", "role": "student" },
  "itemId": "item-1",
  "assignmentId": "attempt-1",
  "disablePartialScoring": true
}
```

## Events

Backend support adds namespaced events without changing existing player events:

- `backend-load-complete`
- `backend-session-saved`
- `backend-score-complete`
- `backend-error`

The existing `session-changed`, `load-complete`, and `player-error` events keep
their current behavior.

## Demo

See [../../apps/backend-demos](../../apps/backend-demos) for a focused delivery
demo with simplified `/api/player/*` endpoints, a SQLite datastore, and backend
controller `model()` / `outcome()` execution.
