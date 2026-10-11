# Item Player Backend Support

`player.backend` connects `<pie-item-player>` to a server that holds the item
and its sessions. Use it when the server keeps the raw models and the scoring:
the server runs each element controller's `model()` and `outcome()`, so the
browser receives models filtered for the learner and never the answer key or the
scoring code ([delivery integrity](../security/readme.md#delivery-integrity)). A
host that has the item config and stores sessions itself sets `config` and
`session` and leaves `backend` unset.

The built-in delivery client speaks the player routes of the PIE API service,
PIE's server that stores items and sessions, runs element controllers and
records scores. A host whose server has another API supplies a
`client` with the same operations. `backend` is a property with no attribute
form.

## Shape

```ts
const player = document.querySelector("pie-item-player");

player.env = { mode: "gather", role: "student" };
player.strategy = "iife";

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

`backend` has three parts: `auth`, the shared credentials; `delivery`, one item
session's load, save, model and score; and `authoring`, draft content's load,
save and release plus the media callbacks. The inputs the player already has
stay where they are: `env`, `strategy`, `loaderOptions`, `renderStimulus`, the
styling props, `config` and `session` have no copy under `backend.delivery`.
The legacy `<pie-api-player>` and `<pie-api-author>` flat props and events map
onto this namespace as the
[migration guide](./migration-from-pie-player-components.md#pie-api-backend)
lists.

## Authentication

The built-in delivery client sends `authorization: Bearer <token>` from
`backend.auth`:

```ts
player.backend = {
  auth: {
    token: "static-dev-token",
    // or, resolved before every request:
    getToken: async () => await fetchJwtForCurrentUser(),
  },
  delivery: { enabled: true, baseUrl: pieApiUrl, itemId: "item-1" },
};
```

`getToken` takes precedence over `token` and runs before each request, including
the save sent while the page goes hidden, so a slow resolver can lose that save.
`backend.delivery.auth` replaces the shared auth for delivery.
`backend.delivery.request` adds `headers` and a `timeoutMs` to every built-in
request; a keepalive save runs without the timeout. A host with cookie
credentials, signed requests or its own token refresh supplies
`backend.delivery.client`. Authoring has no built-in client
([Authoring Contract](#authoring-contract)).

## Delivery Contract

`backend.delivery` is enabled when it is set and `enabled` is not `false`.

| Concern | Behavior |
| --- | --- |
| Load | The player loads the item config and session when delivery is enabled and again whenever the delivery identity changes: `itemId`, `sessionId`, `assignmentId`, `baseUrl`, `provider`, the load endpoint, or whether `client.load` exists. A pending autosave for the outgoing identity is sent first. A load without `itemId` fails. `loadFromBackend("delivery")` loads on demand. The loaded config and session go through the same renderer pipeline as host-set `config` and `session`. |
| Hosted | An enabled `backend.delivery` makes the player hosted unless the host sets `hosted`: it renders the backend's models and runs no element controller in the browser. |
| Model refresh | The models a load returns are current for the `env` it ran under. The player calls the model operation again when `env`, the delivery ids, `options`, the model endpoint or `client.model` changes, and drops a result that arrives after the session or the config changed. A custom `client` without `model` gets no refresh unless the config also selects the built-in client (`provider: "pie-api"`, `baseUrl` or `endpoints.model`). |
| Save | `saveSession()` saves the current session. Autosave is opt-in: `autosave: true`, or `{ enabled?, debounceMs? }` with a 100 ms default debounce. It is scheduled after the player emits a changed session on `session-changed`, so a metadata-only event never schedules it. On the PIE API service a save request also scores the session and records the score. |
| Ordering | Save, model and score requests each carry the session, and the service records it on every one that names a session, so the player sends them one at a time in call order, each with the session as it stood at its call. A failed request rejects only its own caller. When no newer request for the same ids follows it, its session is sent once more at the next flush: the host moving to another item, the page going hidden, or the player tearing down. |
| Page hidden | A pending autosave is sent with `keepalive`, so the request can outlive the document. A body over 64 KiB goes as an ordinary request, because the browser caps keepalive bodies there. A custom `client.saveSession` receives `requestOptions.keepalive` and passes it to `fetch`. |
| Score | `score()` scores on the server and returns what the backend's scoring contract returns. `provideScore()` runs the element controllers in the browser and returns per-model outcomes; a hosted player has none, so it returns an `undefined` slot per model. The two are not interchangeable ([scoring](./scoring-and-rubrics.md)). |

A `client` replaces the built-in client per operation: an operation the client
does not define goes to the built-in client.

### PIE API Wire Contract

The built-in `pie-api` client speaks the PIE API service's player routes, the
ones `<pie-api-player>` also calls. `baseUrl` is the API origin and each default
path carries `/api` (`/api/player/load|save|model|score`); a path in `endpoints`
is appended to `baseUrl` as given, and an absolute URL is used as is.

Every request is a JSON `POST` with `authorization: Bearer <token>` and
`x-date`, the client's clock in epoch milliseconds. The service stamps a
request's session events from `x-date`, so they keep call order when requests
overtake each other. `overrides` comes from `backend.delivery.options.overrides`
and is sent only when it has entries: the service answers 401 to any `overrides`
value, an empty map included, from a token without the `overrides` scope.

A failed request rejects with the service's `error` detail, with the API
gateway's `message` when only that is present, and otherwise with
`Backend request failed with status <status>`.

`assignmentId` names the assignment the service files a session under. A load
without `sessionId` creates a session for `itemId` under that assignment; a load
with one returns that session.

Load:

```json
{
  "itemId": "item-1",
  "sessionId": "item-session-1",
  "assignmentId": "assignment-1",
  "env": { "mode": "gather", "role": "student" }
}
```

The load response carries an item config under `config`, `item` or
`item.config`, or the service's `item: { pie, passage }`, plus an optional
session:

```json
{
  "item": {
    "markup": "<multiple-choice id=\"q1\"></multiple-choice>",
    "elements": {
      "multiple-choice": "@pie-element/multiple-choice@14.0.3"
    },
    "models": [
      { "id": "q1", "element": "multiple-choice", "prompt": "Pick one" }
    ]
  },
  "session": { "id": "item-session-1", "data": [] }
}
```

Save session, answered with an empty 201. The service saves `data` as a session
event, then scores and records the score:

```json
{
  "sessionId": "item-session-1",
  "data": [
    {
      "id": "q1",
      "element": "multiple-choice--version-14-0-3",
      "value": ["a"]
    }
  ],
  "env": { "mode": "gather", "role": "student" },
  "itemId": "item-1",
  "assignmentId": "assignment-1"
}
```

Model refresh names the session when there is one, and the service records
`data` on that session before modeling it:

```json
{
  "sessionId": "item-session-1",
  "data": [],
  "env": { "mode": "gather", "role": "student" },
  "models": [{ "id": "q1", "element": "multiple-choice--version-14-0-3" }],
  "passageModels": [
    { "id": "passage-1", "element": "pie-passage--version-4-5-6" }
  ]
}
```

Without a session it sends `itemId` and `assignmentId` instead, and the service
models the item fresh, ignoring `data` and recording nothing.

`models` and `passageModels` carry the current model identities after the player
has applied `makeUniqueTags`. The service answers with one flat model array under
authored tags (`"multiple-choice"`), which applies to item and passage models
alike; a backend may instead answer `{ models, passageModels }`. An incoming
model updates the current model with the same `id` when its `element` is the
current runtime tag or that tag's authored base. A model naming another element
is ignored.

Score sends the session with the `player.score(options)` fields; `skipCached:
true` makes the service evaluate again instead of answering from its cache.
Partial scoring follows `env.partialScoring`. The response is the service's
score, `{ max, points, partialScoring, type }`, returned as sent
([persisted API scoring](./scoring-and-rubrics.md#persisted-api-scoring)):

```json
{
  "skipCached": true,
  "sessionId": "item-session-1",
  "data": [
    {
      "id": "q1",
      "element": "multiple-choice--version-14-0-3",
      "value": ["a"]
    }
  ],
  "env": { "mode": "gather", "role": "student", "partialScoring": false },
  "itemId": "item-1",
  "assignmentId": "assignment-1"
}
```

## Section And Assessment Players

A section player takes delivery once, on `runtime.player.backend`, and derives
each embedded item player's `backend` from it: `itemId` and `sessionId` per item,
the static fields such as `baseUrl`, `auth`, `assignmentId` and `autosave`
passed through ([section player](../../packages/section-player/README.md)). The
assessment player passes a clone of `sectionPlayerRuntime.player.backend` to its
section player and never copies its `attempt-id` into `assignmentId`, because the
service answers 404 to an assignment it does not hold; a host that delivers under
an assignment sets `assignmentId` itself
([assessment player](../../packages/assessment-player/README.md)). Section and
assessment session snapshots persist through their own hooks,
`createSectionSessionPersistence` and `createAssessmentSessionPersistence`; an
item's `backend.delivery` owns only that item's controller calls.

## Authoring Contract

Authoring backends load, save and release editable item config. Authoring is
separate from delivery because it works with draft content identity
(`contentId`, `collectionId`) rather than an item session.

Authoring has no built-in transport, because the PIE API service serves it over
GraphQL. Each of `load`, `saveContent` and `releaseContent` runs through the
host's `backend.authoring.client`, and an operation the client lacks rejects with
`backend.authoring.client.<operation> is not configured.` A config with only
`media` stays valid for hosts that load content themselves. Authoring loads only
on `loadFromBackend("authoring")`.

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
      onInsertImage: (handler) =>
        handler.done(undefined, "https://cdn.example/image.png"),
    },
  },
};

await player.loadFromBackend("authoring");
const savedContentId = await player.saveContent({ preReleaseType: "prerelease" });
const releasedContentId = await player.releaseContent({ releaseType: "release" });
```

### PIE API Authoring Client

A client for the PIE API service calls the `item`, `saveItem` and `releaseItem`
operations on `<api origin>/graphql`, as `<pie-api-author>` does. A `VersionedID`
is the string `id@version`, and the `version` the service returns is an object,
so the client formats it back:

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

Authoring media callbacks go either on the top-level `onInsertImage`,
`onDeleteImage`, `onInsertSound` and `onDeleteSound` props or under
`backend.authoring.media`, with the same signatures
([authoring media hooks](../../packages/item-player/README.md#authoring-media-hooks)).
The top-level props win when both are set.

## Backend And Persistence Seams

| Concern | Configure at | Owns |
| --- | --- | --- |
| Item delivery | `backend.delivery` on `<pie-item-player>`, or `runtime.player.backend.delivery` on a section player | One item's config, session, model and score through server-side controllers |
| Item authoring | `backend.authoring` on `<pie-item-player>` | Draft content load, save and release through a host `client`, and the authoring media callbacks |
| Section session persistence | `ToolkitCoordinatorHooks.createSectionSessionPersistence` | The section's `SectionControllerSessionState` |
| Assessment session persistence | `AssessmentPlayerHooks.createAssessmentSessionPersistence` | The `AssessmentSession`, with the section snapshots rolled in |
| Section and assessment definitions | Host input | The host loads the definition; no player loads one by identity |
| Tool services | Assessment toolkit tool config | TTS, Desmos and other tool backends, per provider |
| Element loading | `loaderOptions` (sources) and `loaderConfig` (bundle retry, instrumentation) | Element bundles and modules, separate from item delivery |

Authoritative assessment submission and the other open lifecycle guarantees at
these seams are specified in the
[assessment authoritative submission PRD](../prds/assessment-authoritative-submission.md).

## Events

Backend support adds namespaced events and leaves `session-changed`,
`load-complete` and `player-error` as they are:

- `backend-load-complete`
- `backend-model-complete`
- `backend-session-saved`
- `backend-score-complete`
- `backend-content-saved`
- `backend-content-released`
- `backend-error`

`backend-error` reports an automatic delivery load, model refresh or autosave; a
method call rejects its promise instead. The
[item player README](../../packages/item-player/README.md#events) lists each
event's detail.

## Demo

[`apps/backend-demos`](../../apps/backend-demos) runs a local, unauthenticated
delivery backend with simplified `/api/player/*` routes and a SQLite store: load
and model run each controller's `model()`, score runs `outcome()`. It leaves out
authentication, overrides, score caching and manual scores.
