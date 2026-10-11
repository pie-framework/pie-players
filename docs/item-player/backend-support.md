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
    baseUrl: pieApiUrl,
    itemId: "item-1",
    sessionId: "session-1",
    autosave: { enabled: true, debounceMs: 250 },
  },
};
```

Existing delivery inputs stay where they are: `env`, `strategy`,
`loaderOptions`, `renderStimulus`, styling props, `config`,
and `session` are not duplicated under `backend.delivery`.

`backend` is intentionally namespaced. Legacy flat `pie-api-player` and
`pie-api-author` props/events such as top-level `token`, `itemId`,
`contentLoaded`, or `sessionSaved` are not ported onto `<pie-item-player>`.
Delivery and authoring server support live under `backend.delivery` and
`backend.authoring`.

## Authentication

The built-in delivery client sends a bearer token from shared `backend.auth`:

```ts
player.backend = {
  auth: {
    token: "static-dev-token",
    // or:
    getToken: async () => await fetchJwtForCurrentUser(),
  },
  delivery: { enabled: true, baseUrl: pieApiUrl },
};
```

`backend.delivery.auth` overrides shared auth for delivery. Hosts with cookie
credentials, signed requests, or custom JWT refresh behavior provide
`backend.delivery.client` instead of using the built-in fetch client. Authoring
has no built-in client; see [Authoring Contract](#authoring-contract).

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

An enabled `backend.delivery` makes the player hosted unless the host sets
`hosted`: it renders the backend's models, refreshed through the `model`
endpoint when `env` changes, and runs no element controller in the browser.

Backend session persistence is explicit:

```ts
await player.saveSession();
```

Autosave is opt-in through `backend.delivery.autosave`. Autosave listens to the
same normalized `session-changed` event the player already emits.

Save, model and score requests each carry the session, and the PIE API stores
it on every one of them, so the player sends them one at a time in call order,
each with the session as it stood at its call. A failed request rejects only its
own caller. When no newer request for the same ids follows it, its session is
sent once more at the next flush: the host moving to another item, the page
going hidden, or the player tearing down.

Server scoring is separate from local browser scoring:

```ts
const serverScore = await player.score();
const localOutcomes = await player.provideScore();
```

Do not treat these as interchangeable. `provideScore()` calls the element
controllers loaded in the browser and returns per-model outcomes. A hosted
player runs no controllers, so its `provideScore()` returns an `undefined` slot
per model; that includes a player with `backend.delivery` enabled and `hosted`
unset. `score()` delegates to the configured backend and returns whatever the
backend's scoring contract returns.

### pie-api-aws Wire Contract

The built-in `pie-api` client speaks pie-api-aws's player routes, which
`<pie-api-player>` from pie-api-components also calls. `baseUrl` is the API
origin and each default path carries `/api` (`/api/player/load|save|model|score`);
a path in `endpoints` is appended to `baseUrl` as given.

Every request is a JSON `POST` with `authorization: Bearer <token>` and
`x-date`, the client's clock in epoch milliseconds. pie-api-aws stamps a
request's session events from `x-date`, so they keep call order when requests
overtake each other. `overrides` comes from `backend.delivery.options.overrides`
and is sent only when it has entries: pie-api-aws answers 401 to any `overrides`
value, an empty map included, from a token without the `overrides` scope.

A failed request rejects with pie-api-aws's `error` detail, or with the API
gateway's `message` when only that is present.

Load:

```json
{
  "itemId": "item-1",
  "sessionId": "item-session-1",
  "assignmentId": "assignment-1",
  "env": { "mode": "gather", "role": "student" }
}
```

The load response must include an item config under `config`, `item`, or
`item.config`, or pie-api-aws's `item: { pie, passage }`, plus an optional
session:

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
  "session": { "id": "item-session-1", "data": [] }
}
```

Save session, answered with an empty 201 that resolves `saveSession()` to
`null`:

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
  "assignmentId": "assignment-1",
  "models": [{ "id": "q1", "element": "multiple-choice--version-1-2-3" }],
  "passageModels": []
}
```

Model refresh names the session when there is one. pie-api-aws then records
`data` on that session before modelling it:

```json
{
  "sessionId": "item-session-1",
  "data": [],
  "env": { "mode": "gather", "role": "student" },
  "models": [{ "id": "q1", "element": "multiple-choice--version-1-2-3" }],
  "passageModels": [
    { "id": "passage-1", "element": "pie-passage--version-4-5-6" }
  ]
}
```

Without a session it sends `itemId` and `assignmentId` instead, and pie-api-aws
models the item fresh, ignoring `data` and recording nothing.

`models` and `passageModels` carry the current model identities after the
player has applied `makeUniqueTags`. pie-api-aws answers with one flat model
array under authored tags (`"multiple-choice"`); a backend may instead answer
`{ models, passageModels }`. An incoming model updates the current model with
the same `id` when its `element` is either the current runtime tag or that
tag's authored base. A model naming another element is ignored, and a flat array
applies to item and passage models alike.

Score sends the session with any `player.score(options)` fields; `skipCached:
true` makes pie-api-aws evaluate again instead of answering from its cache.
Partial scoring follows `env.partialScoring`. The response is pie-api-aws's
`SessionScore`, `{ max, points, partialScoring, type }`, returned as sent:

```json
{
  "skipCached": true,
  "sessionId": "item-session-1",
  "data": [
    {
      "id": "q1",
      "element": "multiple-choice--version-1-2-3",
      "value": ["a"]
    }
  ],
  "env": { "mode": "gather", "role": "student", "partialScoring": false },
  "itemId": "item-1",
  "assignmentId": "assignment-1"
}
```

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
        assignmentId,
      },
    },
  },
};
```

Section-player treats `backend.delivery.itemId` and `sessionId` as per-item
delivery identity. It derives them from `canonicalItemId || item.id` and the
item session before forwarding `backend` to each embedded item player. Static
delivery fields such as `baseUrl`, `auth`, `endpoints`, `assignmentId`, and
`autosave` are preserved. Set `assignmentId` to the backend assignment the items
are delivered under. Use `runtime.player.resolveBackend` only when the backend
needs custom per-item identity mapping.

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
      },
    },
  },
};
```

Assessment-player passes a clone of `sectionPlayerRuntime.player.backend` to the
nested section-player. The assessment `attempt-id` is not a backend assignment,
so it is never copied into `backend.delivery.assignmentId`: pie-api-aws answers
404 to an assignment it does not hold. A host that delivers under an assignment
sets `assignmentId` itself. Assessment attempt/session persistence stays on
assessment hooks such as `createAssessmentSessionPersistence`; it is not routed
through item `backend.delivery`.

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

Authoring has no built-in transport: pie-api-aws serves it over GraphQL, so each
of `load`, `saveContent`, and `releaseContent` runs through the host's
`backend.authoring.client`, and an operation the client lacks rejects with
`backend.authoring.client.<operation> is not configured.` A config with only
`media` stays valid for hosts that load content themselves.

```ts
player.mode = "author";
player.authoringBackend = "required";
player.backend = {
  authoring: {
    enabled: true,
    contentId: "item-1@1.2.0-draft.1",
    collectionId: "collection-1",
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
    media: {
      onInsertImage: async (done) => done("https://cdn.example/image.png"),
    },
  },
};

await player.loadFromBackend("authoring");
const saveResult = await player.saveContent({ preReleaseType: "prerelease" });
const releaseResult = await player.releaseContent({ releaseType: "release" });
```

### pie-api-aws Authoring Adapter

A client for pie-api-aws calls the `item`, `saveItem`, and `releaseItem`
operations on `<api origin>/graphql`, as `<pie-api-author>` from
pie-api-components does. A `VersionedID` is the string `id@version`, and the
`version` pie-api-aws returns is an object, so the adapter formats it back:

```ts
type SemVer = {
  major: number;
  minor: number;
  patch: number;
  prerelease?: { tag?: string; version?: number } | null;
};

const VERSION = "version { major minor patch prerelease }";

async function gql(query: string, variables: Record<string, unknown>) {
  const response = await fetch(`${pieApiUrl}/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${await fetchJwtForCurrentUser()}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const { data, errors } = await response.json();
  if (errors?.length) throw new Error(errors[0].message);
  return data;
}

function versionedId(item: { id: string; version: SemVer }): string {
  const { major, minor, patch, prerelease } = item.version;
  const pre = prerelease?.tag
    ? `-${prerelease.tag}${typeof prerelease.version === "number" ? `.${prerelease.version}` : ""}`
    : "";
  return `${item.id}@${major}.${minor}.${patch}${pre}`;
}

player.backend = {
  authoring: {
    enabled: true,
    contentId: "item-1@1.2.0-draft.1",
    client: {
      load: async ({ contentId }) => {
        const { item } = await gql(
          `query ($vId: VersionedID!) { item(vId: $vId) { id config ${VERSION} } }`,
          { vId: contentId },
        );
        return { contentId: versionedId(item), config: item.config };
      },
      saveContent: async ({ contentId, collectionId, config, options }) => {
        const { saveItem } = await gql(
          `mutation ($input: SaveItemInput!) { saveItem(input: $input) { id ${VERSION} } }`,
          {
            input: {
              item: { id: contentId?.split("@")[0], config },
              collectionIds: collectionId ? [collectionId] : undefined,
              releaseType: options?.preReleaseType ?? undefined,
            },
          },
        );
        return { contentId: versionedId(saveItem) };
      },
      releaseContent: async ({ contentId }) => {
        const { releaseItem } = await gql(
          `mutation ($vId: VersionedID!) { releaseItem(vId: $vId) { id ${VERSION} } }`,
          { vId: contentId },
        );
        return { contentId: versionedId(releaseItem) };
      },
    },
  },
};
```

`saveItem` always writes a new version, a prerelease unless `releaseType` says
otherwise, and `releaseItem` accepts only a prerelease version.

Authoring media callbacks can be provided either as the existing top-level
`onInsertImage` / `onDeleteImage` / `onInsertSound` / `onDeleteSound` props or
under `backend.authoring.media`. Top-level props win when both are present.

## Backend And Persistence Seams

| Concern | Configure at | Status and purpose |
| --- | --- | --- |
| Item delivery | `<pie-item-player>.backend.delivery` or `runtime.player.backend.delivery` | Implemented. Item config/session/model/score through server-side controllers. |
| Item authoring | `<pie-item-player>.backend.authoring` | Implemented through a host `client`. Draft content load/save/release and authoring media callbacks. |
| Section session persistence | `ToolkitCoordinatorHooks.createSectionSessionPersistence` | Implemented. Hydrate/persist/clear `SectionControllerSessionState`; no `runtime.backend.section` alias is planned. |
| Assessment session persistence | `AssessmentPlayerHooks.createAssessmentSessionPersistence` | Implemented. Hydrate/persist/clear `AssessmentSession`; no `backend.assessment` alias is planned. |
| Assessment finalization | Future dedicated submission strategy | Not implemented. Authoritative submit/idempotency/receipt semantics, separate from ordinary snapshot persistence; see the draft [Assessment Authoritative Submission](../prds/assessment-authoritative-submission.md) PRD. |
| Section or assessment definition loading | Host-provided inputs; possible future definition-source interfaces | Player-initiated loading is not implemented; add it only if it removes repeated host orchestration. Do not combine content loading with session persistence by default. |
| Tool provider backends | Assessment toolkit/tool config | Implemented per provider. TTS, Desmos, and other tool-specific services. |
| Element-loader backend | `loaderConfig` / `loaderOptions` | Implemented. Player/element bundle loading, separate from item delivery. |

## Remaining Front-End Contract Gaps

Besides finalization and definition loading, listed above, the remaining work is
a small set of lifecycle guarantees at existing seams:

1. **Persistence ordering and observability.** Specify whether repeated
   `persist()` calls serialize or coalesce, prevent an older completion from
   becoming the apparent latest save, and expose enough state for host chrome to
   report a recoverable failure. This should deepen the existing controller
   interfaces rather than add another adapter namespace.
2. **Reset parity.** Both persistence strategies already permit
   `clearSession?()`, but controller-level reset/clear behavior and its events are
   not uniform or prominent.
3. **Integrated evidence.** Add one demo/test that exercises assessment
   persistence, section persistence, derived item delivery, and final submission
   together so ownership and duplicate-save behavior are observable.

Backends continue to own durable storage, authorization, conflict policy,
retention, reporting, and workflow. PIE owns the browser lifecycle, canonical
session snapshots, operation ordering, and observable state at its controller
interfaces.

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

See [../../apps/backend-demos](../../apps/backend-demos) for a focused delivery
demo with simplified `/api/player/*` endpoints, a SQLite datastore, and backend
controller `model()` / `outcome()` execution.
