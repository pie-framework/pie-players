# Item player architecture

How `<pie-item-player>` is built and how it carries a learner's session: its
internal components, the session pipeline from element to host, the seams at
which it commits pending responses, and the opt-in session snapshot. PIE stands
for Portable Interactions and Elements. For integrators who persist sessions
themselves and for maintainers of the player. The attribute, property, method
and event reference is the [package README](../../packages/item-player/README.md).

## Custom element

```html
<pie-item-player
  strategy="iife"
  config="..."
  env='{"mode":"gather","role":"student"}'
  session='{"id":"s1","data":[]}'
></pie-item-player>
```

The element is a Svelte 5 custom element rendering into its light DOM, defined
in `packages/item-player/src/PieItemPlayer.svelte`. Importing the package root
registers it as `pie-item-player`
([custom elements](../../packages/item-player/README.md#custom-elements)).

## Internal structure

![Item player internals: the host sets config, session, env, strategy, mode, hosted and backend and receives load-complete, session-changed, player-error, model-loaded and model-updated; inside, the ElementLoader validates the config and registers element tags, PieItemRenderer sanitizes and renders the markup and sets model and session on each PIE element, ItemController owns the session, element controllers build models and are not loaded when hosted, and an optional backend orchestrator talks to the PIE API service](../img/item-player-internals.excalidraw.svg)

### Key components

The item-player package holds the custom element, its public types, the session
forwarding step and the backend orchestrator. The loaders, `ItemController` and
the renderer come from `@pie-players/pie-players-shared`
(`packages/players-shared`).

**`PieItemPlayer.svelte`** (item-player): the custom element. It parses
`config`, registers the item's elements through `ElementLoader` on the path
`strategy` selects, and hands rendering to the shared renderer. It owns the
load lifecycle (loading indicator, error display, loaded state), the last step
of the session pipeline, the commit seams, and the host methods such as
`provideScore()` and `validateModels()`.

**Shared renderer** (`players-shared/src/components/PieItemPlayer.svelte`,
imported by the player as `PieItemRenderer`): renders a loaded `ConfigEntity`'s
markup, binds models and sessions to the PIE custom elements, and forwards
their lifecycle events (`load-complete`, `session-changed`, `player-error`,
`model-updated`, `model-loaded`) to the player. In author mode it delegates
configure-element initialization, validation and media event wiring to the
shared authoring helpers.

**Session forwarding** (`item-player/src/session-forwarding.ts`): decides
whether an element's `session-changed` is a response change, a metadata-only
change, or nothing new
([session management](#session-management)).

**`ItemController`** (`players-shared/src/pie/item-controller.ts`): holds the
session container (`{ id, data }`) in memory, one controller per item, and
guards a session holding a response against an overwrite that carries none.

**`ElementLoader`** (`players-shared/src/loaders/element-loader.ts`): the single
entry point for registering PIE custom elements.

- `ensureRegistered(elements, { backend, ... })` is async and hands the load to
  the adapter `backend` names. Its promise resolves only when every requested
  tag is in `customElements`: the primitive runs the `customElements.whenDefined`
  check after the adapter returns, so an adapter cannot under-register silently.
- `assertRegistered(tags)` is synchronous and throws `ElementAssertionError`,
  naming each missing tag and the tags its package is registered as.

**IIFE adapter** (`players-shared/src/loaders/iife-adapter.ts`): loads IIFE
bundles from the bundle host, the server that builds and serves bundles of the
element packages an item names, by injecting `<script>` tags. Its bundle types
are `player` (elements only, for hosted mode), `clientPlayer` (elements and
controllers) and `editor` (authoring elements), and it records what it loads in
`window.PIE_REGISTRY`. While the bundle host is still building a bundle, the
adapter retries under `loaderConfig.iifeBundleRetry` and the player reports each
attempt as `bundle-retry-status`
([`strategy="iife"`](./loading-strategies.md#strategyiife)).

**ESM adapter** (`players-shared/src/loaders/esm-adapter.ts`): loads the browser
ESM builds an element package publishes under the
[PIE element contract](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/PIE_ELEMENT_CONTRACT.md#browser-esm-packaging),
by CDN URL or through an import map
([`strategy="esm"`](./loading-strategies.md#strategyesm)).

**Preloaded path**: `strategy="preloaded"` uses no adapter. The player calls
`assertRegistered` for the item's tags and loads nothing
([`strategy="preloaded"`](./loading-strategies.md#strategypreloaded)).

## Related topics

- Modes, `env`, attributes, debug logging and the session debugger element:
  [package README](../../packages/item-player/README.md)
- Authoring configuration and media hooks:
  [package README](../../packages/item-player/README.md#authoring-configuration)
- Loading, persisting and scoring through the PIE API backend:
  [backend support](./backend-support.md)
- External stylesheets and the markup sanitizer:
  [content styles](../../packages/item-player/README.md#content-styles) and the
  [security model](../security/readme.md)
- Running the item player inside the section player:
  [section player integration](./loading-strategies.md#section-player-integration)
  and the
  [section player integration guide](../section-player/integration-guide.md)

## Session management

The player's `session-changed` carries the learner's responses to the host,
through a four-step pipeline:

![Session change flow: an element writes the response and emits session-changed; PieItemRenderer stops the event and merges the element's session; deduplication compares the result with ItemController's session and either emits session-changed with the session, emits a metadata-only session-changed with a null session, or emits nothing](../img/item-player-session-flow.excalidraw.svg)

1. When `config` is set, the player creates or reuses an `ItemController` for
   the item and normalizes `session` into
   `{ id: string, data: Array<{ id, element, ... }> }`.
2. The shared renderer stops the element's `session-changed`, merges the
   session the event carries and the one the element holds into the session
   array, and drops an announcement that repeats the element's last `complete`
   and session.
3. Session forwarding ignores an event that carries no `session` and no
   response, then normalizes the rest and compares it with `ItemController`'s
   session. A response change is forwarded. A change in metadata alone, such as
   `complete`, around an unchanged session is forwarded as metadata-only.
   Anything else is dropped.
4. For a response change, the player stores the session through `ItemController`
   and dispatches `session-changed` on `<pie-item-player>` with the whole session
   container in `detail.session`. A metadata-only change reaches the host as
   `session-changed` with `session: null` and `intent: "metadata-only"`, so a
   host that stores `detail.session` skips a `null` one.

An element's controller can write derived state, such as a shuffled choice
order, into its session. That write dispatches no event of its own, so the next
`session-changed` after it carries the session, without `intent`, even when it
would otherwise be metadata-only.

The `session` property stays a live view of that container, the contract
`<pie-player>` had. The player writes an entry per model into the host's object
at `load-complete`, and each change into that entry before it dispatches,
preserving the identity of the array and its entries, so a host that reads
`player.session.data`, or holds a reference into it, keeps working. Inside an
entry the player's session wins and a key it does not carry is removed, so a
cleared response clears in the host's object too.

The projection runs one way. `ItemController` owns the session and does not
observe in-place changes to the host's object, and entries the player did not
produce stay, so a section-level container spanning several items is safe to
pass. A frozen container is left untouched, and the section player hands each
item a per-render copy, so `detail.session` on the event is the authoritative
payload.

Assigning a new value to `session` applies it through
`ItemController.setSession`, with one guard: a session with no `value` field
does not replace a session with the same `id` whose `value` holds a response.
Only a load through `backend.delivery` overwrites such a session. A host that
resets an item assigns a session with a new `id`; the player first commits the
outgoing elements' pending responses into the old container
([session commit](#session-commit)).

The section player's layouts take a `session` property under the same rules. A
host that delivers one item through a layout builds its `section` and `session`
from the item's `config` and `session` with `sectionFromItem`
([section player README](../../packages/section-player/README.md#one-item-as-a-section)).

### Host-managed persistence

A host that persists sessions itself, without `backend.delivery`:

1. Stores `detail.session` from each `session-changed` whose `session` is not
   `null`.
2. Restores a stored session by assigning it to `session` with the item's
   `config`.
3. Calls `commitPendingElementSessions()` on the player before removing it from
   the document, so a pending response reaches its `document`-level listener
   ([session commit](#session-commit)).
4. Opts into the [session snapshot](#session-snapshot) with an explicit
   `sessionSnapshot.key` for recovery after a crash, and handles
   `session-snapshot-available`.

### Session commit

A delivery element coalesces its `session-changed` dispatch, so a response the
learner has finished entering can still be pending when the learner moves on or
the element is discarded. The player commits pending responses at six seams.
What each one reaches differs, and the difference decides what a host has to
do:

| Seam | `sessionCommitReason` | Reaches `document` | Notes |
| --- | --- | --- | --- |
| `focusout` to a target outside the player, or to none | none | yes | The earliest seam. The ordinary event lands before the host acts on the click or key that moved focus. WebKit does not focus a clicked button, so a `focusout` with no target counts as leaving. |
| A change of `config`, `strategy`, `mode`, `loaderOptions` or `loaderConfig.iifeBundleRetry` that reloads the item | `navigate` | yes | The outgoing elements are still mounted and connected. A reassignment that changes none of these is a no-op and commits nothing. |
| A `session` with a different `id` | `navigate` | yes | The outgoing responses are committed into the container they were given for, so they cannot become the next session's answers. |
| `visibilitychange` to `hidden`, and `pagehide` | `page-hidden` | yes | Closing the tab, navigating away and an OS reclaiming a backgrounded tab remove nothing from the DOM. `beforeunload` is not used: it is unreliable on mobile and costs the back/forward cache. |
| `commitPendingElementSessions()`, called by the host | `teardown` | yes | For a host about to remove the player. Called while the player is still in the document, the commit bubbles as usual. |
| The player's own destroy | `teardown` | **no** | A custom element only learns it was removed in `disconnectedCallback`, by which point it is detached. The event reaches the player element itself and the player's own `backend.delivery` save. |

A host that removes `<pie-item-player>` and persists from a `document`-level
listener calls `commitPendingElementSessions()` on the element first.

For a host that persists from its own listener, PIE guarantees the event
arrives; it does not guarantee that the host's request completes, and on the
page-hidden seam the document may unload first. A host that wants the unload
case covered end to end moves its save onto `backend.delivery`, or makes its own
request with `keepalive`. An enabled `backend.delivery` also makes the player
hosted, running no element controller in the browser, so a host that moves only
its save sets `hosted` to `false`.

Both `pagehide` and `visibilitychange` fire on an ordinary navigation. The
commit is per element and compares against the session the host was last told
about, so the second transition announces nothing, and a response that arrives
between the two is still committed, which a "once per hidden transition" guard
would drop.

On the page-hidden path a scheduled `backend.delivery` autosave is flushed
rather than dropped, and the request goes out with `keepalive` so it outlives
the document. A custom `backend.delivery.client` forwards
`requestOptions.keepalive` to its request for this to hold. A body over the
Fetch standard's 64 KiB keepalive cap is sent without the flag: an ordinary
request that the unload may cut short beats one `fetch` rejects outright.

An element that has adopted `createSessionNotifier`
(`@pie-element/shared-player-events`) dispatches its own event with its own
`complete` semantics. An older element gets a `session-changed` synthesized from
its `session` getter; at every seam but `focusout` it carries
`detail.sessionCommitReason`. No element version is required for the
player-side guarantee.

Nothing is announced unless it changed since the host last heard. The
discriminant is a comparison against the session the player last observed for
that element, recorded on the element itself: seeded when the item loads,
updated on every forwarded `session-changed`. A restored response the learner
never touched stays silent, an erased response is announced, and a response the
learner returns to after changing it is announced again. An element the player
never observed falls back to `hasLearnerResponse`, which asks whether the
session holds anything outside identity, dispatch metadata and
controller-written shuffle order.

### Session snapshot

`sessionSnapshot` (property, or the `session-snapshot` attribute) opts into a
device-local copy of each committed session, keyed by the `backend.delivery`
identity and stored in `sessionStorage` by default. A crash or an OS kill fires
no lifecycle event, so nothing else survives it.

There is no snapshot without a delivery `sessionId`. The item id alone is the
same for every learner, so on a shared device a snapshot keyed by it would offer
one student's draft to the next, and the offer is the disclosure, whether or not
the host applies it. A host driving the player by props alone opts in with an
explicit `sessionSnapshot.key` and owns the uniqueness of that key.

The snapshot is offered, never applied. On load, a matching snapshot raises
`session-snapshot-available` with `{ key, session, timestamp }` and the host
decides: school devices are shared, and the player cannot tell a legitimate
recovery from a previous student's draft. The record stays available from
`getPendingSessionSnapshot()` after the event fires, for a host that binds its
listener late.

A host that wants recovery across a full browser restart supplies a
`localStorage`-backed `store` and owns the retention consequences. The snapshot
is cleared on a successful backend save.

The section player's default session persistence applies what it stores, and
stores nothing without a per-learner attempt id
([section player integration guide](../section-player/integration-guide.md#8-session-persistence)).
