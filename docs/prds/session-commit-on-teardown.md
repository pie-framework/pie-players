# Session Commit On Teardown

Status: Accepted for the pie-players and pie-elements-ng contracts

Implementation status: landed in `pie-players` (`commitPendingSessions`,
`bindPageLifecycleCommit`, the item-player and section-player
wiring), in `pie-elements-ng` (`createSessionNotifier` and the five audited
elements), and in both legacy players (`pie-player-components` `watchConfig` and
`disconnectedCallback`; `pie-api-components` teardown and page-hidden commit plus
the save flush). Outstanding: publishing the `pie-elements-ng` element versions,
and whether any element still shipping from legacy `pie-elements` needs the
inline flush — see Open Questions.

Owner:

Related architecture: [`../item-player/overview.md`](../item-player/overview.md),
[`../section-player/`](../section-player), [PIE-1058](https://illuminate.atlassian.net/browse/PIE-1058), [PIE-916](https://illuminate.atlassian.net/browse/PIE-916)

## Problem

A response that the learner has finished entering can be dropped because the UI
that held it went away. Every layer between the editor and the host defers its
session write, and no layer flushes that write when it is torn down.

In `pie-elements`:

- `packages/extended-text-entry/src/main.jsx:60,62` — `debounce(onValueChange, 1500)`
  for value and comment, no `componentWillUnmount`, no `flush()`, no `cancel()`.
- `packages/math-inline/src/index.js:19-21` and
  `packages/math-templated/src/index.js:11-13` — 1000ms debounce on the
  `SessionChangedEvent` dispatch; `disconnectedCallback` unmounts the React root
  without flushing.
- `packages/explicit-constructed-response/src/main.jsx:76` — 200ms with
  `maxWait: 200`, no unmount handler.
- `packages/multiple-choice/src/index.js:143` — `debounce()` with no wait, so
  next-tick; same shape, negligible window.

In the players:

- `pie-api-components` — `src/components/pie-api-player/pie-api-player.tsx:784`
  debounces the backend save 100ms; `disconnectedCallback` at :808 records a New
  Relic page action and nothing else, so the save is dropped on teardown even
  when the element committed in time.
- `pie-player-components` — `src/components/pie-player/pie-player.tsx` has no
  `disconnectedCallback` or `componentDidUnload`, and replaces its elements
  through the `innerHTML` vdom prop after `watchConfig` (:242) sets
  `elementsLoaded = false`.
- `pie-players` — `packages/item-player/src/PieItemPlayer.svelte` has no
  `onDestroy`, and nothing in the repository listens for `pagehide` or
  `visibilitychange`.

The learner-visible failure: type a constructed response, click Next, and the
host destroys the question view inside the element's debounce window. No
`session-changed` is dispatched, so the host cannot detect the loss — there is no
event that failed to arrive. DNAFORM-1097 and DNAFORM-2207 are closed customer
defects on this symptom.

Online Testing works around it today by listening for `keyup` on
`.tiptap.ProseMirror` and locking navigation until their own save completes. That
selector is PIE's suggestion, the lock is a race they have to win, and `keyup`
misses context-menu paste and drag-and-drop, which ProseMirror handles by
`preventDefault()` plus a transaction and which therefore emit no input event
either.

## Goals

- A session mutation that has been committed by the editor reaches the host
  before the element stops existing, with no host-side code.
- One reusable mechanism in the go-forward repositories rather than a pattern
  each element reimplements.
- The same guarantee in the legacy players, since hosts on `<pie-api-player>`
  and `<pie-player>` are the ones hitting this now.
- The section player inherits the guarantee from the item player it already
  mounts, and needs additions only for boundaries it alone owns.
- Quiz Engine's existing `document`-level listener starts receiving the final
  event without Quiz Engine changing anything.
- A commit on the page going away — tab close, navigation, mobile freeze — not
  only on the player being removed from the page.
- A recoverable draft after a crash, offered to the host rather than applied.

## Non-Goals

- Changing any element's debounce delay. The values track input rate — 1500ms for
  free text, 1000ms for math keypad entry, 200ms for short blanks, next-tick for
  clicks — and `explicit-constructed-response` already tunes per model, skipping
  the debounce when every blank is single-character. `extended-text-entry` is the
  exception to the premise rather than to the decision: `EditableHtml` calls
  `props.onChange` only from `commitEditorContent` on blur and from an `isDone`
  transaction, which only `DragInTheBlank` sets, so its 1500ms coalesced nothing
  and was pure loss window. The delay moved to the dispatch unchanged; shortening
  it is a separate decision.
- Removing debounces. Coalescing repeated commits inside one window is worth
  keeping, and the delay is not what loses data.
- A host-called flush method. The guarantee belongs inside the library.
- Guaranteeing that a *network* save completes on a hard kill. No API can promise
  that. The commit reaches the host and, where PIE owns the save, is sent with
  `keepalive`. A device-local recovery draft beyond that is an open question.

## Package And Export Ownership

- Owning package, element side: `@pie-element/shared-player-events`
  (`pie-elements-ng/packages/shared/player-events`), which already owns
  `SessionChangedEvent` at `src/index.ts:46`. `pie-elements-ng` is the source of
  truth for `packages/elements-react/*` and `packages/lib-react/*` and publishes
  from there, so the helper is authored once, in the go-forward repository.
- Legacy `pie-elements` gets no shared helper. Where an element there needs the
  fix, it gets the flush inline in its own `disconnectedCallback` — a few lines,
  no new dependency. The alternative, a shared upstream home, means either
  reviving `@pie-framework/pie-player-events` (published at 0.1.0, no
  `repository` field, source not in any checkout) or adding
  `@pie-lib/render-ui`, and either way a version bump and release across the
  element packages that take it. A few duplicated lines in a repository being
  migrated away from is the cheaper trade.
- Owning package, player side: `@pie-players/pie-players-shared`, exporting
  `commitPendingSessions`, `bindPageLifecycleCommit`,
  `noteSessionBaseline`/`noteSessionObserved` and `hasLearnerResponse`. One
  document-level lifecycle listener per player, never one per element.
- Consuming packages: `pie-elements` and `pie-elements-ng` delivery elements;
  `pie-player-components`; `pie-api-components`; `@pie-players/pie-item-player`;
  `@pie-players/pie-section-player`.
- Runtime environment: browser. Both helpers are DOM-facing and must be
  import-safe in Node without touching `window` at module scope.

## Contract Shape

Three pieces: an element-side rule, one shared helper per side, and a
player-side sweep that uses the element surface that already exists.

### Element rule: session state is synchronous, notification is deferred

`math-inline/src/index.js:57-62` already has the correct shape — it mutates
`this._session` synchronously and defers only the dispatch:

```js
sessionChanged(s) {
  Object.keys(s).map((key) => { this._session[key] = s[key]; });
  this.sessionChangedEventCaller();   // deferred
}
```

`extended-text-entry` and `explicit-constructed-response` defer the value's
propagation instead, so `_session` itself is stale until the timer fires and
there is nothing for any other layer to read. That divergence is what makes a
player-side guarantee impossible for those two, and it is also what forces CR's
flush to re-enter `render()` rather than just dispatching.

The rule: an element updates its own session synchronously on commit, and only
the `session-changed` dispatch may be deferred.

This also removes a live inconsistency in the public surface. Reading
`el._session.value` after `session-changed` — the pattern currently suggested to
hosts — is correct for the math elements and wrong for CR.

### Element helper: `createSessionNotifier`

```ts
// Documentation sketch only.
export interface SessionNotifier {
  /** Schedule a `session-changed` dispatch, coalescing within `delayMs`. */
  notify(): void;
  /** Dispatch immediately if one is pending; no-op otherwise. */
  flush(): void;
  /** Drop a pending dispatch without dispatching. */
  cancel(): void;
  readonly pending: boolean;
  dispose(): void;
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
export function cancelSessionNotifiers(host: object): void;
export function hasPendingSessionNotification(host: object): boolean;
```

`createSessionNotifier` registers the returned notifier against `host`, so one
`flushSessionNotifiers(this)` in `disconnectedCallback` commits every
notification the element owns whatever its internal structure —
`extended-text-entry` has one per session field, to keep each path's `complete`
semantics. The flush stays an explicit call rather than being installed on the
element: patching `disconnectedCallback` from a factory hides the teardown from
the class that owns it.

The helper does install `commitPendingSession()` on the host. That is the half a
player depends on across element versions, so it cannot be something an element
forgets. `flush()` swallows a throwing dispatch, since a commit runs mid-unmount.

`flush()` is a no-op when nothing is pending, so teardown adds no event in the
normal path. Where it does fire, it emits the one event that was already
scheduled. The delay is implemented with `setTimeout`, so the package keeps no
dependencies.

### Player helper: `commitPendingSessions`

```ts
// Documentation sketch only.
export function commitPendingSessions(
  root: ParentNode | null | undefined,
  options?: { reason?: SessionCommitReason; logger?: PieLogger },
): { committed: number; synthesized: number; skipped: number };
```

The player calls this at the seam where it is about to discard elements, while
they are still attached. Two paths per element:

- An element that owns its deferred notification exposes
  `commitPendingSession()`, so it dispatches its own event with its own
  `complete` semantics. This is the path an adopted element takes.
- An older element gets a `session-changed` synthesized from its `session`
  getter, carrying `component` and `sessionCommitReason` and omitting `complete`
  — `complete` is element-specific knowledge the player does not have, and
  `SectionController` leaves completion untouched when the field is absent
  rather than regressing it.

Both paths carry `detail.sessionCommitReason`. An element dispatching its own
commit cannot set it — it knows nothing about the seam — so the sweep marks that
event from a capture listener on its root, held for the length of the sweep. The
marker is the field every guard in a `session-changed`'s way keys on to let a
commit past: the Stencil player's 150 ms model-set blocker, the item renderer's
duplicate-payload suppression, the section shells' cross-shell dedupe, and
`<pie-api-player>`'s decision to save now instead of debouncing. Leaving it to
the synthesized path only was implemented and corrected: the guards exempted a
commit from the path that never needed exempting and dropped the one from the
five elements that had adopted the notifier. A capture listener on the root runs
before the target's own listeners and before every bubble listener at or above
the root, which is where all four guards sit.

The synthesized path is what makes the player-side fix independent of element
adoption: `math-inline`, `math-templated` and `multiple-choice` already wrote
their session synchronously and deferred only the dispatch, so on an old version
the read carries the response the deferred dispatch would have announced.

The element discriminant is a `session` accessor plus a `model` setter, which
keeps the sweep off player chrome and tool elements. 25 of the 31 delivery
elements expose `get session()`; the six that do not — `calculator`,
`complex-rubric`, `passage`, `protractor`, `rubric`, `ruler` — have no response
to expose and are skipped. `pie-player.tsx:347-348,404,446` already resolves its
child elements by `id`/`pie-id` and reads and writes that same property.

The sweep walks the flattened tree: `children`, then open shadow roots, then the
elements assigned to each `<slot>`. All three are load-bearing in the section
player, which mounts each item inside `<pie-item-shell>`'s shadow root and
projects its item pane through a slot on the assessment toolkit. A walk that
stops at `<slot>` finds no delivery element in a section at all — implemented
and corrected: the first version stopped there, and the section-player commit
was inert until an end-to-end test proved it.

### Discriminant: has anything happened since the host last heard

Nothing is announced unless it changed. The sweep records the session signature
it last saw for an element, on the element itself, and compares:

- Seeded when the item loads, so a restored response the learner has not touched
  is never announced.
- Updated on every `session-changed` the player forwards, so a response the host
  already has is never re-announced.
- Different means pending: the element wrote its session and has not dispatched.

This replaces asking whether a session "looks answered", which is a guess about
each element's schema and wrong in both directions: `value` is one element's
answer key while `response`, `selectedTokens`, `answers`, `answer` and
`drawables` are others, so a `value`-only test skips nine answered shapes and
drops an erasure (`value: []`, `value: ""`) — the learner clears an answer and
the host keeps the old one. In the other direction it passes an unanswered
`ebsr`, whose `value` holds part structure before any part is answered.

The record lives on the element under a `Symbol.for` key rather than in a
module-scope `WeakMap`, for two reasons. A nested player stack loads two copies
of this module from different bundles, and module state lets each layer announce
the same commit. And a map of what the *sweep* emitted is not a record of what
the host holds: answer A, hide, answer B, answer A again, navigate inside the
debounce, and a sweep that remembered only its own emissions skips — leaving the
host on B.

An element the player never observed has no baseline. That happens on paths the
player does not own, and there the sweep falls back to `hasLearnerResponse`:
anything outside identity, dispatch metadata and controller-written shuffle
order, with content in it. A mounted element the learner never answered holds
identity only, and announcing that as a change is both false and load-bearing —
a host that re-renders on `session-changed` can cancel work it is in the middle
of. Emitting it at the config seam made the item player's demo host re-push its
own config, so a second load took the request token and the incoming item was
discarded. A host that re-pushes config should ignore an event carrying
`sessionCommitReason`.

The synthesized path is a pure read: it never mutates the session object it
reads, serializes before emitting so the host cannot alias element-owned state,
and skips an element whose getter is absent, throws, or returns nothing.

Dispatching while attached is what makes this stronger than the element's own
unmount flush. `disconnectedCallback` runs after removal, so the element's flush
dispatches from a detached node: bubbling still reaches a listener inside the
removed subtree, and never reaches one bound to `document`. The player-side sweep
reaches both — at the seams that run while connected. Its own teardown seam does
not, and cannot; see below.

### Teardown seams

| Player | Seam |
| --- | --- |
| `pie-api-player` | `disconnectedCallback` — sweep, then save when the session differs from what the backend last saw. Disconnection callbacks run in tree order, so this fires before `<pie-player>`'s and has to sweep itself; it cannot route the result through its own `@Listen`, because Stencil removes host listeners before the callback runs. The signature comparison also covers the debounced save that was still pending, which the `() => void` typing on the field had hidden `.flush()` behind |
| `pie-player` | `watchConfig` before `elementsLoaded = false` triggers the markup replacement, plus a `disconnectedCallback` it did not have |
| `pie-item-player` | `loadConfig`, past its no-op signature guard, which is where the rendered elements are about to be replaced and where they are still mounted and connected; plus the component's own `onDestroy` for a host that removes the element outright, and the imperative `commitPendingElementSessions()` for a host that wants `document` reach on an unmount it controls. Not the renderer's `onDestroy`: that component is the one a `{#key}` swap replaces on a config change, so a commit routed through its listener writes player state in the middle of that swap. The orchestrator's autosave timer is flushed instead of cleared, both on teardown and when the host repoints `backend.delivery` |
| `pie-item-shell` | the `$effect` teardown in `ItemShellElement.svelte`, already described there as "the shell's only real teardown" and already the origin of `pie-unregister` |

A Stencil `disconnectedCallback` runs after the element has left the document, so
its commit reaches a host listener bound inside the removed subtree and not one on
`document`. Stencil also removes its own host listeners before the callback runs,
so a commit made there cannot reach a `@Listen` on the component or an ancestor —
which is why `pie-api-player` decides its own save from a session signature
instead of waiting to be told. Reaching `document` requires committing while
connected: `watchConfig`, the config seam, the section controller's boundaries,
the lifecycle binding below, and the imperative commit a host calls before it
unmounts a player.

The same limit binds `pie-item-player`, which is a Svelte custom element: its
`onDestroy` runs from `disconnectedCallback`, after detachment. Two consequences,
both measured in a browser rather than reasoned about. The renderer's forwarding
listener is already gone by then, so that commit has to capture its elements'
events on the host and forward them itself. And the player's root `<div>` can
already be detached from the custom element, so the resulting event is dispatched
from the custom element rather than the div. With both, the commit reaches the
player element and the player's own `backend.delivery` save; it does not reach
`document`, and the imperative commit is the supported path for a host that
needs that.

Flushing `pie-api-player`'s save issues an HTTP request during teardown. That
completes for a client-side view teardown, which is the case losing data today.
A real page unload needs the lifecycle binding below.

### Page lifecycle commit

The teardown seams above only fire when something in the page removes the
player. Closing the tab, navigating away, backgrounding a mobile browser, or
having the OS reclaim the tab removes nothing — the document goes away underneath
the player.

```ts
// Documentation sketch only.
export function bindPageLifecycleCommit(options: {
  /** Re-evaluated per transition, for a container the player replaces. */
  root: () => ParentNode | null | undefined;
  /** Runs after the synchronous commit, for players that own a backend save. */
  onHidden?: (reason: SessionCommitReason) => void;
  logger?: PieLogger;
}): () => void; // unbind
```

`visibilitychange` to `hidden` is the primary signal, because it is the last
event mobile browsers reliably deliver before freezing or discarding a page.
`pagehide` is the backstop for same-document navigations and back/forward cache
entry, and for iOS Safari, which can fire it with no preceding
`visibilitychange`. Both fire on an ordinary navigation; the per-element
discriminant makes the second transition a no-op, which is why the binding does
not guard itself with a "once per hidden transition" flag — such a flag drops a
response that arrives after the document reports hidden and before the real
unload. `beforeunload` is not used: it is unreliable on mobile, blocks nothing
useful here, and costs the back/forward cache.

The handler runs `commitPendingSessions(root)` synchronously, which is the only
kind of work a hidden or unloading document performs dependably. A player that
owns a backend save sends it with `fetch(url, { keepalive: true })` rather than
`navigator.sendBeacon`, because beacon requests cannot carry the
`Authorization` header that `backend.auth` supplies. `keepalive` bodies are
capped at 64KB across all in-flight keepalive requests, which bounds a very long
constructed response.

`keepalive` reaches `fetch` through `BackendRequestOptions.keepalive`, so a
custom `delivery.client` can honour it too, and the request timeout is skipped on
that path — aborting a keepalive request defeats the only reason it was issued.
A host-supplied client that does not forward the flag gets an ordinary request:
the option is passed, honouring it is the client's job, and the consumer pad
records that as a consumer-side requirement.

A body over the 64KB cap is sent without the flag rather than with it. Past the
cap `fetch` rejects, so the save is lost outright on the one path that exists as
a last resort; an ordinary request the unload may cut short is a worse chance
than a small body gets and a better one than none.

For a host that persists from its own listener — Online Testing and Quiz Engine
both do — PIE guarantees the event arrives, not that the host's request
completes. Hosts wanting the unload case covered end to end either move their
save onto `backend.delivery` or make their own handler `keepalive`.

## Compatibility

Surfaces touched:

- PIE element runtime/controller contracts — yes. The element rule changes when
  `_session` is updated relative to the dispatch. It does not change the
  `session-changed` payload, the property names, or the dispatch's timing floor.
- `pie-item-player` properties, events, or imperative methods — one new
  imperative method, `commitPendingElementSessions()`. `session-changed` gains a
  guaranteed final emission; nothing is renamed. The lifecycle commit is on by
  default, since it emits an event the host already handles and stores nothing.
- `section-player` session/completion state — unchanged. The section player
  receives the same normalized events it does now, and one more of them at
  teardown.
- Versioned `pie-*--version-*` tag names — untouched.
- Contract attributes — untouched.
- Persisted session data or host-facing wire data — unchanged.

Notes:

- Hosts that already listen for `session-changed` need no change and get the
  guarantee. Hosts that added DOM-level workarounds can delete them; nothing
  breaks if they do not.
- Elements that have not adopted the helper keep working with their current
  behaviour, so rollout is incremental per element.
- Hosts cannot always move element versions, so every player-side change is safe
  against old elements and detects per element rather than per item — a single
  item routinely mixes versions, because the versions in a bundle depend on the
  item's whole element set.
- An old element cannot serve a stale session to the sweep. The elements that
  debounce the value path mutate the session and dispatch in the same tick —
  `extended-text-entry/src/index.js:66-72` is the pattern — so `el.session` holds
  exactly what the host was last told. The sweep's worst case there is a
  duplicate, which the signature check suppresses, and never an older value
  overwriting a newer one. What it cannot do is recover text the editor has not
  committed; only the element-side fix reaches that.
- The player-side changes therefore stand on their own value rather than on
  element adoption: the `pie-api-player` flush and the lifecycle commit both
  act on sessions the player already holds, whatever version produced them.
- A host listening on `document` receives the final event only via the
  player-side sweep, which is why both halves ship rather than the element flush
  alone.

## Data Ownership And Host Responsibilities

PIE owns:

- Updating element session state synchronously on commit.
- Delivering a final `session-changed` before the element stops existing, and
  before the page goes away.
- Flushing its own pending backend save in players that own one, with
  `keepalive` on the unload path.

Hosts own:

- Durable persistence.
- Identity and authorization.
- Storage, retention, privacy, and product policy.
- Reporting, gradebooks, workflow, and standards certification.

## Serialization And Versioning

This PRD defines no persisted or wire-facing contract. Session payloads,
schemas, and validation ownership are unchanged.

## Accessibility

No user-facing runtime change. No focus, keyboard, screen-reader, captions,
reduced-motion, or high-contrast impact. The final dispatch happens after the
editor has already lost focus.

## Standards Or Adapter Impact

None. No adapter or validation suite is scoped here.

## Section Player

The section player mounts items through `pie-item-player`
(`packages/section-player/src/component-definitions.ts:16,28,40`), so it inherits
the item-player guarantee without changes of its own.

Intra-section navigation is already safe, and for a structural reason rather than
by timing: `SectionItemsPane.svelte:656` renders every item in the section —
`{#each items as item, itemIndex (item.id || itemIndex)}` — and navigation only
flips `isCurrent={itemIndex === currentItemIndex}` at :672. The editor is never
unmounted between questions, so the debounce always completes. This is why Quiz
Engine, which persists off these same events, has not hit the defect that Online
Testing has.

What the section player alone owns is the boundary where a section does go away:
section change and submit. `SectionController.navigateToItem()` is synchronous,
flips `currentItemIndex`, emits `item-selected`, and committed nothing;
`persist()` is async and sits on a path navigation never calls.

`SectionController` stays DOM-free, so it takes the commit as an injected
callback through `setPendingSessionCommit()` — declared on
`SectionControllerHandle`, so a host implementing that interface can see it — and
runs it before item navigation, before `updateInput()` snapshots the session for
a section swap, and before `persist()`. `PieSectionPlayerBaseElement` registers
it with `<pie-assessment-toolkit>` as the root, on the controller the toolkit
already holds as well as through the factory it wraps so a cohort flip commits
before the outgoing controller is replaced. A host-built controller that never
registers a commit keeps its current behaviour.

A raw `session-changed` does not leave a section: `<pie-item-shell>` stops it and
re-dispatches the normalized `PIE_ITEM_SESSION_CHANGED_EVENT`. So inside a
section the commit's reach is the controller, and a host persists from the
controller's events or its session snapshot. A commit is exempt from both of the
shell's dedupes, because a shell being replaced for the same item otherwise
falls inside the cross-shell window and the outgoing shell's last response is
dropped.

The commit sits in `updateInput()` rather than `initialize()` because
`updateInput()` snapshots the session before delegating, so a commit inside
`initialize()` would land in state that snapshot had already taken.

Quiz Engine is the host this matters to. Its wrapper listens with
`@HostListener('document:session-changed')` and persists with
`void this.persistSection(previousSectionId)` — fire-and-forget, no lock, no
await. A student typing in the last question of a section and immediately
advancing snapshots pre-commit state, silently. Because the listener is on
`document`, the element-side unmount flush alone would not reach it; the
player-side sweep, dispatching while attached, does. Quiz Engine changes nothing.

What this does not close is a host that persists on its own navigation before it
feeds the new section to the player: PIE has no hook ahead of that. Such a host
gets the guarantee on its next save, plus the shell teardown and page-lifecycle
commits.

Coverage lives with the code it pins: a per-element teardown test in
`pie-elements-ng` (`packages/elements-react/*/tests/delivery-session-commit.test.ts`),
the sweep and discriminant in `packages/players-shared/tests/session-commit.test.ts`,
the seams in the item- and section-player suites, and the vendored copy's own spec
in each Stencil repo.

Release risk is concentrated in the element rule. A synchronous session update
shortens the round trip through the host and back into `EditableHtml`, where a
`props.markup` change calls `editor.commands.setContent` and discards the caret
when the normalized markup differs from what the editor holds. For
`extended-text-entry` that round trip is bounded by the callback firing only on
blur, so there is no caret to lose; `explicit-constructed-response` keeps its
render on the deferred path at the 200ms cadence it already had.

## Open Questions

- Which legacy `pie-elements` elements need the inline flush at all, which
  depends on what still ships from there when this lands.
- Whether PIE writes a device-local recovery draft at all, and whether it would
  also cover the section-level session `SectionController` owns, which no item
  player can see. Implemented and parked on
  `feat/PIE-1058-session-snapshot`: it is the only piece carrying a host-facing
  storage decision, and no reported defect turns on it. The connectivity case
  George Schneiderman raised for Online Testing is what would justify it.
- Whether `multiple-choice`'s zero-delay debounce is worth touching at all, or
  should simply become a direct dispatch.
- Whether `extended-text-entry`'s 1500ms is worth keeping now that it is on the
  dispatch. It coalesces nothing on a blur-only callback, so its only remaining
  effect is to delay the host's first sight of a committed response.
- Whether the orchestrator's identity-aware `flushPendingSave` deserves an
  automated test. It has none: the orchestrator lives in a `$effect`-bearing
  module with no unit harness, and covering the repoint race needs either that
  harness or a backend-demo control for repointing `backend.delivery`.

Settled during implementation:

- `pie-player` gets both `watchConfig` and a `disconnectedCallback`. Only
  `watchConfig` runs while connected, so only it reaches a `document` listener.
  The teardown callback does not reach a wrapping `<pie-api-player>` either:
  Stencil removes host listeners before `disconnectedCallback` and an ancestor's
  runs first, which is why `<pie-api-player>` sweeps and decides its own save
  rather than waiting to be told.
- The section player binds one lifecycle commit at its own root and the item
  players keep theirs. The overlap costs nothing because the discriminant lives
  on the element under a `Symbol.for` key: the first layer to commit records the
  signature and the second finds nothing pending. Module state would not do —
  the nested Stencil stack loads two copies of the sweep from different bundles,
  and each would announce the same commit.
- `SectionControllerHandle.setPendingSessionCommit` has to be registered on the
  controller the toolkit already holds, not only through the factory the player
  overrides. The factory reaches controllers built after the player's effect
  runs, and the first section's controller exists before that: registering only
  through it left the first section's navigation with no commit at all.
- The item player's own destroy cannot reach `document`, and its two internal
  obstacles are separate from that: the renderer's forwarding listener is gone
  by then, and the player's root `<div>` can already be detached from the custom
  element. Both were found by measuring the seam in a browser after the unit
  tests passed.
