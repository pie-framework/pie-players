# Session Commit On Teardown

Status: Accepted, 2026-09-17

Implementation status: landed in pie-players (`commitPendingSessions`,
`bindPageLifecycleCommit`, the session snapshot, and the item-player,
section-player and toolkit wiring); in
[pie-elements-ng](https://github.com/pie-framework/pie-elements-ng)
(`createSessionNotifier` and the five delivery elements that defer their
dispatch: `extended-text-entry`, `explicit-constructed-response`,
`math-inline`, `math-templated` and `multiple-choice`; the Svelte elements
dispatch synchronously and need no notifier); in legacy
[pie-elements](https://github.com/pie-framework/pie-elements)
(`extended-text-entry`); and in both legacy players: `<pie-player>`
([pie-player-components](https://github.com/pie-framework/pie-player-components))
commits in `watchConfig` and `disconnectedCallback`, and `<pie-api-player>`
commits at teardown and on page hide and flushes its debounced save.
Outstanding: which other legacy pie-elements elements need the inline flush (see
Open Questions). The session snapshot is opt-in.

Owner: PIE Players maintainers

Related architecture:

- [Session commit](../item-player/overview.md#session-commit) and
  [Session snapshot](../item-player/overview.md#session-snapshot) in the item
  player architecture
- [Commit at a section boundary](../../packages/section-player/README.md#commit-at-a-section-boundary)
  in the section player README

## Problem

Before this contract, a response the learner had finished entering could be
lost because the UI holding it went away. Every layer between the editor and the
host deferred its session write and none flushed it on teardown: delivery
elements debounced their `session-changed` dispatch (next-tick to 1500 ms),
`<pie-api-player>` debounced its backend save by 100 ms, and no player committed
when it replaced its elements, was removed, or the page went away. A learner
typed a constructed response and clicked Next, the host destroyed the view
inside the debounce window, and no `session-changed` was ever dispatched, so the
host had no failed event to detect. The only host-side workaround, locking
navigation on editor key events until the host's own save completed, raced that
save and missed context-menu paste and drag-and-drop, which the editor applies
as transactions without an input event.

## Goals

- A session mutation the editor has committed reaches the host before the
  element stops existing, with no host-side code.
- One reusable mechanism in the go-forward repositories rather than a pattern
  each element reimplements.
- The same guarantee in the legacy players, `<pie-player>` and
  `<pie-api-player>`, which existing hosts deliver through.
- The section player inherits the guarantee from the item player it mounts, and
  adds commits only at the boundaries it alone owns.
- A host's existing `document`-level `session-changed` listener receives the
  final event with no change on the host's side.
- A commit when the page goes away (tab close, navigation, mobile freeze) as
  well as when the player is removed from the page.
- A recoverable draft after a crash, offered to the host rather than applied.

## Non-Goals

- Changing any element's debounce delay. The values track input rate: 1500 ms
  for free text, 1000 ms for math keypad entry, 200 ms for short blanks,
  next-tick for clicks, and `explicit-constructed-response` skips the delay
  when every blank is single-character. `extended-text-entry`'s 1500 ms
  coalesced nothing, because `EditableHtml` calls `props.onChange` only on blur
  (`commitEditorContent`) and from an `isDone` transaction that only
  `DragInTheBlank` sets; the delay moved to the dispatch unchanged, and
  shortening it is a separate decision.
- Removing debounces. Coalescing repeated commits inside one window is worth
  keeping, and the delay is not what loses data.
- A host-called flush method. The guarantee belongs inside the library.
- Guaranteeing that a network save completes on a hard kill, which no API can
  promise. The commit reaches the host and, where PIE owns the save, goes out
  with `keepalive`; past that, the snapshot is the recovery path.
- Silently restoring a snapshot over a server-loaded session. School devices are
  shared, so a recovered draft is offered for the host to accept.

## Package And Export Ownership

- Owning package, element side: `@pie-element/shared-player-events`
  ([pie-elements-ng `packages/shared/player-events`](https://github.com/pie-framework/pie-elements-ng/tree/develop/packages/shared/player-events)),
  which already owns `SessionChangedEvent`. pie-elements-ng is the source of
  truth for its React elements and libraries and publishes from there, so the
  helper is authored once, in the go-forward repository. The package has no
  dependencies; the delay is a `setTimeout`.
- Legacy pie-elements gets no shared helper. An element there that needs the
  fix gets the flush inline in its own `disconnectedCallback`: a few lines and
  no new dependency. A shared upstream home would mean reviving
  `@pie-framework/pie-player-events` (published at 0.1.0 with no source
  repository) or adding `@pie-lib/render-ui`, and either way a version bump and
  release across every element package that takes it. A few duplicated lines in
  a repository being migrated away from cost less.
- Owning package, player side: `@pie-players/pie-players-shared`, exporting
  `commitPendingSessions`, `flushPendingSessionNotifications`,
  `bindPageLifecycleCommit`, `noteSessionBaseline`/`noteSessionObserved`,
  `hasLearnerResponse`, and the snapshot store contract from its root and `/pie`
  entries. One document-level lifecycle listener per player, never one per
  element.
- Consuming packages: the pie-elements and pie-elements-ng delivery elements;
  `<pie-player>` and `<pie-api-player>`; `@pie-players/pie-item-player`;
  `@pie-players/pie-section-player`; `@pie-players/pie-assessment-toolkit`.
- Runtime environment: browser. Both helpers are DOM-facing and import in
  Node.js without touching `window` at module scope.

## Contract Shape

Three pieces: an element-side rule, one shared helper per side, and a
player-side sweep over the element surface that already exists.

### Element session rule

An element updates its own session synchronously on commit, and only the
`session-changed` dispatch may be deferred.

Legacy `math-inline` has this shape: it mutates `this._session` synchronously
and defers only the dispatch.

```js
sessionChanged(s) {
  Object.keys(s).map((key) => { this._session[key] = s[key]; });
  this.sessionChangedEventCaller();   // deferred
}
```

An element that defers the value's propagation instead, as older
`extended-text-entry` and `explicit-constructed-response` releases do, leaves
`_session` stale until the timer fires, so no other layer has anything to read.
For those only the element-side fix closes the gap, and it is why the
pie-elements-ng `explicit-constructed-response` coalesces its re-render with the
dispatch: its flush re-renders as well as dispatching.

The rule also makes the element's session read the same across elements.
Reading it after `session-changed` was correct for the math elements and stale
for `explicit-constructed-response`.

### Element helper: `createSessionNotifier`

```ts
export interface SessionNotifier {
  /** Schedule a `session-changed` dispatch, coalescing within `delayMs`. */
  notify(): void;
  /** Dispatch immediately if one is pending; no-op otherwise. */
  flush(): void;
}

export function createSessionNotifier(
  host: object,
  dispatch: () => void,
  options?: {
    /** A function is re-evaluated per `notify()`, for a model-dependent delay. */
    delayMs?: number | (() => number);
    maxWaitMs?: number;
  },
): SessionNotifier;

export function flushSessionNotifiers(host: object): void;
```

`createSessionNotifier` registers the returned notifier against `host`, so one
`flushSessionNotifiers(this)` in `disconnectedCallback` commits every
notification the element owns, whatever its internal structure:
`extended-text-entry` has one per session field, to keep each path's `complete`
semantics. The flush stays an explicit call in the element: patching
`disconnectedCallback` from a factory hides the teardown from the class that
owns it.

The helper does install `commitPendingSession()` on the host. That is the half a
player depends on across element versions, so it cannot be something an element
forgets. `flush()` swallows a throwing dispatch, since a commit runs
mid-unmount. It is a no-op when nothing is pending, so teardown adds no event in
the normal path; where it fires, it emits the one event already scheduled.

### Player helper: `commitPendingSessions`

```ts
export type SessionCommitReason = "teardown" | "navigate" | "page-hidden";

export interface CommitPendingSessionsOptions {
  /** Defaults to "teardown"; recorded as `detail.sessionCommitReason`. */
  reason?: SessionCommitReason;
  logger?: PieLogger;
}

export function commitPendingSessions(
  root: ParentNode | null | undefined,
  options?: CommitPendingSessionsOptions,
): { committed: number; synthesized: number; skipped: number };
```

The player calls this at the seam where it is about to discard elements, while
they are still attached. Two paths per element:

- An element that owns its deferred notification exposes
  `commitPendingSession()` and dispatches its own event with its own `complete`
  semantics; this is the path an adopted element takes. What the element
  dispatches is what counts as announced. The method is a no-op when nothing is
  pending, and a session written without notifying (a controller writing into
  it, an element path that stores a value quietly) would otherwise be recorded
  as delivered and skipped at every later seam, so a commit that dispatches
  nothing falls through to the synthesized path.
- An older element gets a `session-changed` synthesized from its `session`
  getter, carrying `component` and `sessionCommitReason`. `pie-item-player`
  fills `complete` from whether the element's record holds a response, the same
  derivation a restore without `complete` gets.

Both paths carry `detail.sessionCommitReason`. An element dispatching its own
commit cannot set it, since it knows nothing about the seam, so the sweep marks
that event from a capture listener on its root, held for the length of the
sweep. The marker is the field every guard in a `session-changed`'s way keys on
to let a commit past: `<pie-player>`'s 150 ms model-set blocker, the item
renderer's duplicate-payload suppression, `<pie-item-scope>`'s repeat
suppression, and `<pie-api-player>`'s decision to save now instead of
debouncing. A capture listener on the root runs before the target's own
listeners and before every bubble listener at or above the root, which is where
all four guards sit. Marking only the synthesized path was implemented and
reverted: the guards then dropped the commits of exactly the elements that had
adopted the notifier.

The synthesized path makes the player-side fix independent of element adoption:
`math-inline`, `math-templated` and `multiple-choice` already wrote their session
synchronously and deferred only the dispatch, so on an old version the read
carries the response the deferred dispatch would have announced.

The element discriminant is a `session` accessor plus a `model` setter, which
keeps the sweep off player chrome and tool elements. The delivery elements with
no response to expose (`calculator`, `complex-rubric`, `passage`, `protractor`,
`rubric`, `ruler`) have no `session` getter and are skipped. `<pie-player>`
already resolves its child elements by `id`/`pie-id` and reads and writes that
same property.

The sweep walks the flattened tree: `children`, then open shadow roots, then the
elements assigned to each `<slot>`. All three are load-bearing in the section
player, which mounts each item inside a shadow root and projects its item pane
through a slot on the assessment toolkit; a walk that stops at `<slot>` finds no
delivery element in a section at all.

### Change discriminant

Nothing is announced unless it changed since the host last heard. The sweep
records the session signature it last saw for an element, on the element itself,
and compares:

- Seeded when the item loads, so a restored response the learner has not touched
  is never announced.
- Updated on every `session-changed` the player forwards, so a response the host
  already has is never re-announced.
- Different means pending: the element wrote its session and has not dispatched.

Asking whether a session "looks answered" instead is a guess about each
element's schema, and wrong in both directions. `value` is one element's answer
key while `response`, `selectedTokens`, `answers`, `answer` and `drawables` are
others, so a `value`-only test skips nine answered shapes and drops an erasure
(`value: []`, `value: ""`): the learner clears an answer and the host keeps the
old one. In the other direction it passes an unanswered `ebsr`, whose `value`
holds part structure before any part is answered.

The record lives on the element under a `Symbol.for` key rather than in a
module-scope `WeakMap`, for two reasons. A nested player stack loads two copies
of this module from different bundles, and module state lets each layer announce
the same commit. And a map of what the sweep emitted is not a record of what the
host holds: answer A, hide, answer B, answer A again, navigate inside the
debounce, and a sweep that remembered only its own emissions skips, leaving the
host on B.

An element the player never observed has no baseline. That happens on paths the
player does not own, and there the sweep falls back to `hasLearnerResponse`:
anything outside identity, dispatch metadata and controller-written shuffle
order, with content in it. A mounted element the learner never answered holds
identity only, and announcing that as a change is both false and load-bearing: a
host that re-renders on `session-changed` can cancel work in progress, and at
the config seam such an event made a host re-push its own config and discard the
incoming item. A host that re-pushes config ignores an event carrying
`sessionCommitReason`.

The synthesized path is a pure read: it never mutates the session object it
reads, serializes before emitting so the host cannot alias element-owned state,
and skips an element whose getter is absent, throws, or returns nothing.

Dispatching while attached is what makes the sweep stronger than the element's
own unmount flush. `disconnectedCallback` runs after removal, so the element's
flush dispatches from a detached node: bubbling still reaches a listener inside
the removed subtree, and never one bound to `document`. The player-side sweep
reaches both, at the seams that run while connected.

### Teardown seams

| Player | Seam |
| --- | --- |
| `<pie-item-player>` | `focusout` to a target outside the player, or to none |
| `<pie-item-player>` | `loadConfig`, past its no-op signature guard |
| `<pie-item-player>` | a `session` carrying a different id |
| `<pie-item-player>` | `commitPendingElementSessions()`, called by a host before it unmounts the player |
| `<pie-item-player>` | the component's `onDestroy` |
| `<pie-item-scope>` | its `$effect` teardown, in section mode |
| `<pie-assessment-toolkit>` | a section switch, and its own teardown |
| `<pie-player>` | `watchConfig`, before `elementsLoaded = false` triggers the markup replacement; `disconnectedCallback` |
| `<pie-api-player>` | `disconnectedCallback` |

Reaching `document` requires committing while connected: the focus-leave flush,
`watchConfig`, the config and session seams, the section boundaries, the
lifecycle binding below, and the imperative commit. A `disconnectedCallback`
runs after the element has left the document, so a commit there reaches the
player element and listeners inside the removed subtree only.

Focus leaving the player is the earliest seam. `flushPendingSessionNotifications`
runs the same sweep with no reason, so the event is an ordinary one and lands
before the host acts on the click or key that moved focus; every later seam then
finds nothing pending for that element. A missing `relatedTarget` counts as
leaving, because WebKit does not focus a clicked button.

`loadConfig` commits past its no-op guard, where the rendered elements are about
to be replaced and are still mounted and connected. A `session` whose id differs
from the current one (a new attempt, or another item in a card the host kept
mounted) commits the mounted elements' pending responses into the outgoing
session before the incoming one reaches the controller. Both seams sit in the
player component and not in the renderer's `onDestroy`: the renderer is what a
`{#key}` swap replaces on a config change, so a commit routed through its
listener would write player state in the middle of that swap.

The player's `onDestroy` covers a host that removes `<pie-item-player>`
outright. A Svelte custom element runs it from `disconnectedCallback`, after
detachment, so this commit reaches the player element and the player's own
`backend.delivery` save. By then the renderer's forwarding listener is gone, so
the commit captures its elements' events on the host and forwards them itself,
and the player's root `<div>` can already be detached from the custom element,
so the event is dispatched from the custom element. A host that persists from a
`document` listener calls `commitPendingElementSessions()` before it unmounts
the player. The commit is registered before the backend orchestrator, since
Svelte destroys effects in creation order and the orchestrator's teardown
flushes the pending save. The orchestrator flushes its autosave timer instead of
clearing it, both on teardown and when the host repoints `backend.delivery`, and
sends that save under the identity it was scheduled for.

`<pie-player>` commits in `watchConfig` and in a `disconnectedCallback`; only
`watchConfig` runs while connected. `<pie-api-player>` sweeps in its own
`disconnectedCallback`, then saves when the session differs from what the
backend last saw, which also covers a debounced save still pending. It cannot
wait to be told: disconnection callbacks run in tree order, so its callback runs
before `<pie-player>`'s, and Stencil removes host listeners before the callback
runs, so no commit reaches a `@Listen` on the component or an ancestor. Its
teardown save is an HTTP request issued during teardown, which completes for a
client-side view teardown; a page unload needs the lifecycle binding below.

### Page lifecycle commit

The teardown seams fire only when something in the page removes the player.
Closing the tab, navigating away, backgrounding a mobile browser, or the OS
reclaiming the tab removes nothing: the document goes away underneath the
player.

```ts
export interface BindPageLifecycleCommitOptions {
  /** Re-evaluated per transition, for a container the player replaces. */
  root: () => ParentNode | null | undefined;
  /** Runs after the synchronous commit, for players that own a backend save. */
  onHidden?: (reason: SessionCommitReason) => void;
  logger?: PieLogger;
}

export function bindPageLifecycleCommit(
  options: BindPageLifecycleCommitOptions,
): () => void; // unbind
```

`visibilitychange` to `hidden` is the primary signal, because it is the last
event mobile browsers reliably deliver before freezing or discarding a page.
`pagehide` is the backstop for same-document navigations, back/forward cache
entry, and iOS Safari, which can fire it with no preceding `visibilitychange`.
Both fire on an ordinary navigation, and the per-element discriminant makes the
second a no-op. The binding has no "once per hidden transition" guard, because
such a guard drops a response that arrives after the document reports hidden and
before the real unload. `beforeunload` is not used: it is unreliable on mobile,
blocks nothing useful here, and costs the back/forward cache.

The handler runs `commitPendingSessions(root)` synchronously, the only kind of
work a hidden or unloading document performs dependably. A player that owns a
backend save sends it with `fetch(url, { keepalive: true })`, because
`navigator.sendBeacon` cannot carry the `Authorization` header that
`backend.auth` supplies. The Fetch standard caps `keepalive` bodies at 64 KiB
across all in-flight keepalive requests, which bounds a very long constructed
response and is one reason the snapshot below exists. A body over the cap is
sent without the flag: past the cap `fetch` rejects, so the save would be lost
outright, and an ordinary request the unload may cut short still has a chance.

`keepalive` reaches `fetch` through `BackendRequestOptions.keepalive`, so a
custom `backend.delivery.client` can honor it too, and the request timeout is
skipped on that path, since aborting a keepalive request defeats the reason it
was issued. A host-supplied client that does not forward the flag sends an
ordinary request; forwarding it is the client's job, and the
[consumer API dependencies record](../integrations/consumer-api-dependencies.md)
lists it as a consumer-side requirement.

For a host that persists from its own listener, PIE guarantees the event
arrives, not that the host's request completes. A host wanting the unload case
covered end to end moves its save onto `backend.delivery` or makes its own
handler `keepalive`. An enabled `backend.delivery` also makes the player hosted,
running no element controller in the browser, so a host moving only its save
sets `hosted` to `false`.

### Session snapshot

A crash or an OS kill fires nothing at all, so the only state that survives is
state already written. The snapshot writes each committed session to device
storage and offers it back on the next load.

```ts
export interface SessionSnapshotStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
  clear(key: string): void;
}

export type SessionSnapshotConfig =
  | boolean
  | {
      enabled?: boolean;
      /** Defaults to `sessionStorage`. */
      store?: SessionSnapshotStore;
      /** Defaults to a key derived from the delivery identity. */
      key?: string;
    };

export function createSessionSnapshot(args: {
  config: SessionSnapshotConfig | null | undefined;
  identity: { itemId?: string; sessionId?: string; assignmentId?: string };
}): SessionSnapshot | null; // null without an opt-in, or with neither a sessionId nor a key
```

The item player takes it as the `sessionSnapshot` property, with a
`session-snapshot` attribute for the boolean opt-in; a host-supplied `store`
holds functions and can only arrive as a property. Every store access is
wrapped, including a host-injected one: private mode and blocked site data make
the accessor throw, and the player keeps working without a snapshot.

The config follows the shape of `BackendAutosaveConfig`, and the default key is
built from `BackendDeliveryIdentity` (both in
`packages/item-player/src/backend/types.ts`), so no new identity concept
appears.

A delivery `sessionId` is required for the default key. It is the only field
that distinguishes one learner's attempt from another's: keyed by item id alone,
which is all a host driving the player by props has, a shared device offers the
previous student's draft to the next, and the offer is the disclosure whether or
not the host applies it. Such a host opts in with an explicit `key` and owns its
uniqueness.

`sessionStorage` is the default store. It is tab-scoped and cleared when the tab
closes, so a response does not outlive the sitting on a shared device, and
browser session restore brings it back after a crash. A host wanting recovery
across a full browser restart injects a `localStorage`-backed `store` and owns
the retention consequences.

Writes happen on each committed session and on page hide, synchronously, so the
same write covers the lifecycle path. A successful backend save
(`backend-session-saved`) clears the snapshot.

On load, a snapshot whose key matches is offered and never applied. The player
emits `session-snapshot-available` with `{ key, session, timestamp }`, and the
host decides: auto-restoring risks reviving a previous student's draft on a
shared machine, and the player cannot tell that case from a legitimate recovery.
The record stays readable from `getPendingSessionSnapshot()`, since a one-shot
event loses the recovery for a host that binds its listener a tick late.

### Section boundaries

The section player mounts items through `pie-item-player`, so it inherits the
item-player guarantee. Navigation inside a section keeps every item mounted:
`SectionItemsPane` renders all of the section's items and navigation changes
only which one is current. No editor is unmounted between questions, so its
debounce completes on its own.

`SectionController` still commits before item navigation, before `updateInput()`
snapshots the session for a section swap, and before `persist()`. The response
belongs to the item being left, and a host that persists on the navigation event,
or a `persist()` that follows it, would otherwise snapshot a session the learner
had already changed. The commit sits in `updateInput()` rather than
`initialize()` because `updateInput()` snapshots the session before delegating,
so a commit inside `initialize()` would land in state that snapshot had already
taken.

`SectionController` stays DOM-free, so it takes the commit as an injected
callback through `setPendingSessionCommit()`, declared on
`SectionControllerHandle` so a host implementing that interface can see it.
`PieSectionPlayerBaseElement` registers it with `<pie-assessment-toolkit>` as the
root, both through the controller factory it installs and on the controller the
toolkit already holds: the first section's controller usually exists before the
player's effect runs, and the factory reaches only controllers built after it. A
host-built controller that never registers a commit keeps its behavior and loses
a pending response at those boundaries.

A section switch is the toolkit's boundary. `<pie-assessment-toolkit>` commits
from its own root before it initializes the next section, while the outgoing
controller still holds the host's section subscriptions; the coordinator detaches
those as soon as it starts on the next section. The toolkit commits again at its
own teardown, because it is torn down before its item scopes, whose teardown
commits would find its event channel closed.

The section player binds one lifecycle commit at its own root and the item
players keep theirs. The overlap costs nothing, because the discriminant lives
on the element under a `Symbol.for` key: the first layer to commit records the
signature and the second finds nothing pending.

A raw `session-changed` does not leave its `<pie-item-scope>`, which
re-dispatches it as the normalized `item-session-changed`
(`PIE_ITEM_SESSION_CHANGED_EVENT`); the toolkit then publishes the section's
canonical `session-changed`, and both reach `document`. A commit is exempt from
the scope's repeat suppression, because it is the response's last chance to
reach the section. A host persists from those events, the controller's events,
or the controller's session snapshot.

A host that persists fire-and-forget from a `document` listener needs no change:
when a learner types in a section's last question and advances at once, the
sweep commits while the elements are attached, which the element's own unmount
flush cannot do. A host that persists on its own navigation before it feeds the
next section to the player gets the response from the focus-leave flush, ahead
of its navigation, when that navigation is a click or key press in its own
controls. A navigation that leaves focus in the editor depends on the next
save, the item-scope teardown and the page-lifecycle commits.

## Compatibility

Surfaces touched:

- PIE element runtime/controller contracts: yes. The element rule changes when
  `_session` is updated relative to the dispatch. It does not change the
  `session-changed` payload, the property names, or the dispatch's timing floor.
- `pie-item-player` properties, events, or imperative methods: one event,
  `session-snapshot-available`; the opt-in `sessionSnapshot` property and
  `session-snapshot` attribute; and two methods, `commitPendingElementSessions()`
  and `getPendingSessionSnapshot()`. `session-changed` gains a guaranteed final
  emission; nothing is renamed. The lifecycle commit is on by default, since it
  emits an event the host already handles and stores nothing.
- `section-player` session/completion state: unchanged. The section player
  receives the same normalized events, plus commits at its boundaries.
  `SectionControllerHandle` gains the optional `setPendingSessionCommit`.
- Versioned `pie-*--version-*` tag names: untouched.
- Contract attributes: untouched.
- Persisted session data or host-facing wire data: unchanged.

Notes:

- Hosts that already listen for `session-changed` need no change and get the
  guarantee. Hosts that added DOM-level workarounds can delete them; nothing
  breaks if they do not.
- Elements that have not adopted the helper keep their current behavior, so
  rollout is incremental per element.
- Hosts cannot always move element versions, so every player-side change is safe
  against old elements and detects per element rather than per item: a single
  item routinely mixes versions, because the versions in a bundle depend on the
  item's whole element set.
- An old element cannot serve a stale session to the sweep. The elements that
  debounce the value path write the session and dispatch in the same call, as
  older `extended-text-entry` releases do, so `el.session` holds exactly what
  the host was last told. The sweep's worst case there is a duplicate, which the
  signature check suppresses, and never an older value overwriting a newer one.
  What it cannot do is recover text the editor has not committed; only the
  element-side fix reaches that.
- The player-side changes therefore stand on their own value: the
  `<pie-api-player>` flush, the lifecycle commit, and the snapshot act on
  sessions the player already holds, whatever element version produced them.
  The snapshot is entirely version-independent.
- A host listening on `document` receives the final event only through the
  player-side sweep, which is why both halves ship rather than the element flush
  alone.

## Data Ownership And Host Responsibilities

PIE owns:

- Updating element session state synchronously on commit.
- Delivering a final `session-changed` before the element stops existing, and
  before the page goes away.
- Flushing its own pending backend save in players that own one, with
  `keepalive` on the unload path.
- Offering a recovered snapshot, when the host enabled one.

Hosts own:

- Durable persistence.
- Whether a snapshot is written at all, where it is stored, and how long it
  lives. PIE writes learner responses to the device only when a host enables it,
  and the default store is tab-scoped for that reason.
- Deciding whether to accept a recovered snapshot.
- Forwarding `requestOptions.keepalive` in a host-supplied
  `backend.delivery.client`.
- Identity and authorization.
- Storage, retention, privacy, and product policy.
- Reporting, gradebooks, workflow, and standards certification.

## Serialization And Versioning

This PRD defines no persisted or wire-facing contract. Session payloads,
schemas, and validation ownership are unchanged.

## Accessibility

No user-facing runtime change. No focus, keyboard, screen-reader, captions,
reduced-motion, or high-contrast impact. The focus-leave flush observes
`focusout` and moves no focus.

## Standards Or Adapter Impact

None. No adapter or validation suite is scoped here.

## Test Plan

Coverage lives with the code it pins:

- pie-elements-ng: the notifier in
  `packages/shared/player-events/tests/session-notifier.test.ts`, and a
  teardown test per adopting element in
  `packages/elements-react/*/tests/delivery-session-commit.test.ts`.
- `packages/players-shared/tests/session-commit.test.ts`: both commit paths, the
  commit marker, the discriminant, the focus-leave flush and the lifecycle
  binding. `session-snapshot.test.ts`: keying, the identity rule and the opt-in.
- `packages/item-player/tests/`: the teardown, focus-leave and session-swap
  seams in a browser (`item-player-session-commit-teardown.spec.ts`,
  `item-player-focus-leave-flush.spec.ts`, `item-player-session-swap.spec.ts`),
  and the orchestrator's flush and resend (`backend-autosave-retry.test.ts`,
  `backend-session-write-order.test.ts`).
- `packages/section-player/tests/`: the controller boundaries
  (`section-controller-session-commit.test.ts`) and the section commit end to
  end (`section-player-session-commit.spec.ts`).
- Each Stencil repository: a spec for its vendored copy of the sweep.

Not covered: a host repointing `backend.delivery` while an autosave is pending.
The orchestrator harness in `packages/item-player/tests/support/` can host that
test.

## Rollout And Release Notes

- Rollout: incremental per element. The player-side sweep, the lifecycle commit
  and the snapshot act on whatever element version is mounted.
- Migration notes: none required. The host actions in Compatibility and in the
  [consumer API dependencies record](../integrations/consumer-api-dependencies.md)
  are for hosts that re-push config, supply their own delivery client, or move
  navigation state on session events.
- Documentation: integrator behavior is in the item player's
  [Session commit](../item-player/overview.md#session-commit) and
  [Session snapshot](../item-player/overview.md#session-snapshot), and the section
  player's
  [Commit at a section boundary](../../packages/section-player/README.md#commit-at-a-section-boundary).
- Release risk: concentrated in the element rule. A synchronous session update
  shortens the round trip through the host and back into `EditableHtml`, where a
  `props.markup` change calls `editor.commands.setContent` and discards the caret
  when the normalized markup differs from what the editor holds. For
  `extended-text-entry` that round trip is bounded by the callback firing only
  on blur, so there is no caret to lose; `explicit-constructed-response` keeps
  its render on the deferred path at the 200 ms cadence it already had.

## Open Questions

- Which legacy pie-elements elements need the inline flush at all, which
  depends on what still ships from there.
- Whether a snapshot should also cover the section-level session that
  `SectionController` owns, which no item player can see.
- Whether `multiple-choice`'s zero-delay debounce should become a direct
  dispatch.
- Whether `extended-text-entry`'s 1500 ms is worth keeping on the dispatch. It
  coalesces nothing on a blur-only callback, so its only effect is to delay the
  host's first sight of a committed response.
