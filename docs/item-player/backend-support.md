# Backend Support

`<pie-item-player>` remains a config/session/env-driven rendering element. The
backend API is a JS-only namespace for loading and persisting those same inputs,
not a replacement for existing delivery props.

## Shape

Direct item-player hosts set the backend namespace on the element:

```ts
const player = document.querySelector("pie-item-player");

player.env = { mode: "gather", role: "student" };
player.strategy = "iife";
player.loaderOptions = {
  bundleHost: "https://proxy.pie-api.com/bundles/",
};

player.backend = {
  auth: {
    getToken: async () => jwt,
  },
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

`backend` is intentionally namespaced. Legacy flat `pie-api-player` and
`pie-api-author` props/events such as top-level `token`, `itemId`,
`contentLoaded`, or `sessionSaved` are not ported onto `<pie-item-player>`.
Delivery and authoring server support live under `backend.delivery` and
`backend.authoring`.

## Authentication

The built-in JSON clients support bearer tokens through shared `backend.auth`:

```ts
player.backend = {
  auth: {
    token: "static-dev-token",
    // or:
    getToken: async () => await fetchJwtForCurrentUser(),
  },
  delivery: { enabled: true, baseUrl: bffUrl },
  authoring: { enabled: true, baseUrl: bffUrl },
};
```

`backend.delivery.auth` and `backend.authoring.auth` override shared auth for
that scope. Hosts with cookie credentials, GraphQL, signed requests, or custom
JWT refresh behavior can provide `backend.delivery.client` or
`backend.authoring.client` instead of using the built-in fetch client.

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

### Section Session Persistence

Section session persistence is already implemented and deliberately does not live
under `runtime.player.backend`. `ToolkitCoordinatorHooks.createSectionSessionPersistence`
creates a `SectionSessionPersistenceStrategy` for each
`(assessmentId, sectionId, attemptId)` context. The section controller exposes
`hydrate()`, `persist()`, `getSession()`, and `applySession()` over the canonical
`SectionControllerSessionState` shape.

Use this seam for section navigation, item-session aggregation, formative state,
and timed-media state. Do not route those section-owned snapshots through each
item player's `backend.delivery`; that namespace owns only one item's controller
calls.

What is not implemented is player-initiated loading of a section definition by
identity. Hosts currently load an `AssessmentSection` and pass it as player input.
A future definition-source interface should be considered separately from the
existing session-persistence strategy rather than combining both behind a broad
`runtime.backend.section` namespace.

## Assessment-player Runtime Configuration

Hosts that render through `<pie-assessment-player-default>` configure item
delivery at the assessment-owned section-player boundary:

```ts
assessmentPlayer.setAttribute("attempt-id", assessmentAttemptId);
assessmentPlayer.sectionPlayerRuntime = {
  player: {
    backend: {
      auth: { getToken: fetchJwtForCurrentUser },
      delivery: {
        enabled: true,
        baseUrl: bffUrl,
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

Assessment-player passes `sectionPlayerRuntime.player.backend` to the nested
section-player. If `backend.delivery.assignmentId` is absent, assessment-player
defaults it from the assessment `attempt-id` on a cloned runtime object. Explicit
host values, including an intentionally empty string, are preserved. Assessment
attempt/session persistence stays on assessment hooks such as
`createAssessmentSessionPersistence`; it is not routed through item
`backend.delivery`.

### Assessment Session Persistence And Submission

Assessment persistence is already implemented through
`AssessmentPlayerHooks.createAssessmentSessionPersistence`. Its strategy loads,
saves, and optionally clears the canonical `AssessmentSession`; the assessment
controller exposes `hydrate()`, `persist()`, `getSession()`, and `submit()` and
rolls embedded section snapshots into the assessment session.

This is the canonical foreign-system seam. A parallel `backend.assessment`
namespace would duplicate it without adding behavior and is not currently
planned. Two narrower gaps remain:

- Assessment definitions must be loaded by the host before they reach the player;
  there is no player-initiated definition source.
- `submit()` marks the local controller submitted and persists the final snapshot,
  but there is no separate authoritative finalization adapter with idempotency,
  receipt, retry, or conflict semantics.

Those gaps should be designed independently: definition loading is content input,
while finalization is a terminal attempt operation. Neither belongs in item
`backend.delivery`.

## Authoring Contract

Authoring backends load, save, and release editable item config. This is
separate from delivery because authoring works with draft content identity rather
than item-session identity.

```ts
player.mode = "author";
player.authoringBackend = "required";
player.backend = {
  auth: { getToken: fetchJwtForCurrentUser },
  authoring: {
    enabled: true,
    baseUrl: bffUrl,
    contentId: "item-1@draft",
    collectionId: "collection-1",
    endpoints: {
      load: "/api/authoring/load",
      saveContent: "/api/authoring/save",
      releaseContent: "/api/authoring/release",
    },
    media: {
      onInsertImage: async (done) => done("https://cdn.example/image.png"),
    },
  },
};

await player.loadFromBackend("authoring");
const saveResult = await player.saveContent({ preReleaseType: "prerelease" });
const releaseResult = await player.releaseContent({ releaseType: "release" });
```

Custom clients receive the same identity and env context as the built-in JSON
client:

```ts
player.backend = {
  authoring: {
    enabled: true,
    contentId: "item-1@draft",
    client: {
      load: async ({ contentId, collectionId, env }) => ({
        contentId,
        config: await loadDraft({ contentId, collectionId, env }),
      }),
      saveContent: async ({ contentId, collectionId, config, env, options }) => {
        return await saveDraft({ contentId, collectionId, config, env, options });
      },
      releaseContent: async ({ contentId, collectionId, env, options }) => {
        return await releaseDraft({ contentId, collectionId, env, options });
      },
    },
  },
};
```

Authoring media callbacks can be provided either as the existing top-level
`onInsertImage` / `onDeleteImage` / `onInsertSound` / `onDeleteSound` props or
under `backend.authoring.media`. Top-level props win when both are present.

## Backend And Persistence Seams

| Concern | Configure at | Status and purpose |
| --- | --- | --- |
| Item delivery | `<pie-item-player>.backend.delivery` or `runtime.player.backend.delivery` | Implemented. Item config/session/model/score through server-side controllers. |
| Item authoring | `<pie-item-player>.backend.authoring` | Implemented. Draft content load/save/release and authoring media callbacks. |
| Section session persistence | `ToolkitCoordinatorHooks.createSectionSessionPersistence` | Implemented. Hydrate/persist/clear `SectionControllerSessionState`; no `runtime.backend.section` alias is planned. |
| Assessment session persistence | `AssessmentPlayerHooks.createAssessmentSessionPersistence` | Implemented. Hydrate/persist/clear `AssessmentSession`; no `backend.assessment` alias is planned. |
| Assessment finalization | Future dedicated submission strategy | Not implemented. Authoritative submit/idempotency/receipt semantics, separate from ordinary snapshot persistence. |
| Section or assessment definition loading | Host-provided inputs; possible future definition-source interfaces | Player-initiated loading is not implemented. Do not combine content loading with session persistence by default. |
| Tool provider backends | Assessment toolkit/tool config | Implemented per provider. TTS, Desmos, and other tool-specific services. |
| Element-loader backend | `loaderConfig` / `loaderOptions` | Implemented. Player/element bundle loading, separate from item delivery. |

## Remaining Front-End Contract Gaps

The remaining work is not a generic backend namespace. It is a small set of
lifecycle guarantees at existing or narrowly defined seams:

1. **Authoritative assessment finalization.** Keep ordinary snapshot persistence
   on `AssessmentSessionPersistenceStrategy`, but give a host one terminal
   submission operation with idempotency and a typed receipt. See the draft
   [Assessment Authoritative Submission](../prds/assessment-authoritative-submission.md)
   PRD.
2. **Persistence ordering and observability.** Specify whether repeated
   `persist()` calls serialize or coalesce, prevent an older completion from
   becoming the apparent latest save, and expose enough state for host chrome to
   report a recoverable failure. This should deepen the existing controller
   interfaces rather than add another adapter namespace.
3. **Reset parity.** Both persistence strategies already permit
   `clearSession?()`, but controller-level reset/clear behavior and its events are
   not uniform or prominent.
4. **Definition loading, only if consumer pressure requires it.** A host can
   already fetch section and assessment definitions before assigning player
   inputs. Add a definition-source interface only if player-owned loading removes
   repeated host orchestration; do not add it merely for symmetry with item
   delivery.
5. **Integrated evidence.** Add one demo/test that exercises assessment
   persistence, section persistence, derived item delivery, and final submission
   together so ownership and duplicate-save behavior are observable.

Backends continue to own durable storage, authorization, conflict policy,
retention, reporting, and workflow. PIE owns the browser lifecycle, canonical
session snapshots, operation ordering, and observable state at its controller
interfaces.

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
  "assignmentId": "attempt-1",
  "models": [{ "id": "q1", "element": "multiple-choice--version-1-2-3" }],
  "passageModels": [
    { "id": "passage-1", "element": "pie-passage--version-4-5-6" }
  ]
}
```

`models` and `passageModels` carry the exact current model identities after the
player has applied `makeUniqueTags`. Model refresh responses must use the same
`id` and full versioned `element` tag to update an existing model. Responses
that return a base tag such as `"multiple-choice"` for a rendered
`"multiple-choice--version-1-2-3"` model are ignored.

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

Authoring load:

```json
{
  "contentId": "item-1@draft",
  "collectionId": "collection-1",
  "env": { "mode": "author", "role": "instructor" }
}
```

Authoring save:

```json
{
  "contentId": "item-1@draft",
  "collectionId": "collection-1",
  "config": { "id": "item-1", "markup": "...", "elements": {}, "models": [] },
  "env": { "mode": "author", "role": "instructor" },
  "options": { "preReleaseType": "prerelease" }
}
```

Authoring release:

```json
{
  "contentId": "item-1@draft.1",
  "collectionId": "collection-1",
  "env": { "mode": "author", "role": "instructor" },
  "options": { "releaseType": "release" }
}
```

## Events

Backend support adds namespaced events without changing existing player events:

- `backend-load-complete`
- `backend-model-complete`
- `backend-session-saved`
- `backend-score-complete`
- `backend-content-saved`
- `backend-content-released`
- `backend-error`

The existing `session-changed`, `load-complete`, and `player-error` events keep
their current behavior.

## Demo

See [../../apps/backend-demos](../../apps/backend-demos) for focused delivery
and authoring demos with simplified `/api/player/*` and `/api/authoring/*`
endpoints, a SQLite datastore, and backend controller `model()` / `outcome()`
execution.
