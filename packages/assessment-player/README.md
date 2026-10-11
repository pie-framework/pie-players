# @pie-players/pie-assessment-player

`<pie-assessment-player-default>` is the reference assessment player: a
multi-section player assembled only from the public exports of the section
player, the assessment toolkit and `@pie-players/pie-players-shared`. It serves
prototypes and demos, and it is the worked example for teams that build their
own. It has no production users. Production assessment players are host-built
from the same packages
([product scope](../../docs/architecture/architecture.md#product-scope)), and
this package changes without a compatibility period.

This README is the API reference for a host that mounts it: inputs, host
methods, the controller, hooks, events and persistence.
[Building a Multi-Section Player](../../docs/assessment-player/integration-guide.md)
builds a player from the toolkit's assessment-session helpers, with this one as
the worked example, and the [assessment demos](../../apps/assessment-demos/README.md)
run it.

## Install

```bash
npm install @pie-players/pie-assessment-player
```

```ts
import "@pie-players/pie-assessment-player";
```

Importing the package registers `pie-assessment-player-default` and
`pie-assessment-player-shell`, and its import of `@pie-players/pie-section-player`
registers the section player layouts. The entry is bundler-only and
browser-only: it imports `@pie-players/pie-section-player` and
`@pie-players/pie-assessment-toolkit` by bare specifier. The package has no
browser build, so a CDN cannot serve it; its `unpkg` and `jsdelivr` fields name
the bundler entry.

## Elements

| Element | Role |
| --- | --- |
| `pie-assessment-player-default` | Runs an assessment's sections one at a time in a section player, with a position label and Back and Next buttons |
| `pie-assessment-player-shell` | A layout frame with a `navigation` slot; it deletes its children ([Shell element](#shell-element)) |

## Usage

```html
<pie-assessment-player-default
  assessment-id="algebra-unit-1"
  attempt-id="attempt-42"
  section-player-layout="splitpane"
></pie-assessment-player-default>
```

```ts
import "@pie-players/pie-assessment-player";
import type {
  AssessmentDefinition,
  AssessmentPlayerHooks,
  AssessmentPlayerRuntimeConfig,
  AssessmentPlayerRuntimeHostContract,
} from "@pie-players/pie-assessment-player";
import type { AssessmentSession, ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";

type AssessmentPlayerElement = HTMLElement &
  AssessmentPlayerRuntimeConfig &
  AssessmentPlayerRuntimeHostContract & {
    coordinator: ToolkitCoordinator | null;
    session: AssessmentSession | null;
  };

declare const assessment: AssessmentDefinition;
declare const hooks: AssessmentPlayerHooks;

const player = document.querySelector<AssessmentPlayerElement>("pie-assessment-player-default");
if (player) {
  player.assessment = assessment;
  player.hooks = hooks;
  player.env = { mode: "gather", role: "student" };
}
```

An `AssessmentDefinition` lists its sections in `testParts[].sections` or in
`sections`. The default delivery plan flattens them in order; a section without
an `identifier` gets `section-{index}`, or `section-{part}-{index}` inside a test
part.

## Inputs

| Input | Attribute | Default | A change |
| --- | --- | --- | --- |
| `assessmentId` | `assessment-id` | — | Rebuilds the controller |
| `attemptId` | `attempt-id` | — | Rebuilds the controller. Without one the default persistence neither reads nor writes |
| `assessment` | property | — | Rebuilds the controller |
| `hooks` | property | — | Rebuilds the controller ([Hooks](#hooks)) |
| `session` | property | — | Rebuilds the controller from the new value, under the rules in [Lifecycle](#lifecycle) |
| `env` | property | — | Sets `runtime` on the mounted section: `{ mode, role }` |
| `coordinator` | property | — | Sets `runtime` on the mounted section: a host-owned `ToolkitCoordinator` every section shares |
| `playerType` | `player-type` | `iife` | Sets `runtime` on the mounted section: the element loading strategy, `iife`, `esm` or `preloaded` |
| `sectionPlayerRuntime` | property | — | Re-attaches instrumentation, then sets `runtime` on the mounted section ([Section runtime](#section-runtime)) |
| `sectionPlayerLayout` | `section-player-layout` | `splitpane` | Remounts the section, keeping its session and the controller. `vertical` selects the vertical layout; any other value the splitpane |
| `showNavigation` | `show-navigation` | `true` | Shows or hides the position label and the Back and Next buttons |
| `locale` | `locale` | `en-US` | Relabels the chrome and sets the section's `locale` attribute, removing it when empty |
| `debug` | `debug` | — | Sets `window.PIE_DEBUG` ([Debug logging](#debug-logging)) |

The element starts once it is connected and holds both `assessmentId` and
`assessment`; until then it shows an empty state. Inputs assigned in the same
turn are batched, whether before or after connecting. A rebuild retires the
current controller at once and starts the next in a microtask, which remounts
the section. An object input changes only when replaced: mutating an assigned
object in place signals nothing. `env`, `coordinator`, `playerType` and
`sectionPlayerRuntime` reach the mounted section without a remount.

### Section runtime

Each mounted section player receives a `runtime` built from the element's
inputs:

| `runtime` key | Source |
| --- | --- |
| `playerType` | `playerType` |
| `assessmentId` | `assessmentId`, when set |
| `env` | `env`, when set |
| `coordinator` | `coordinator`, when set |
| `player` | `sectionPlayerRuntime.player`, with `backend` deep-cloned |
| Any other key | `sectionPlayerRuntime` |

A key in `sectionPlayerRuntime` overrides the element's own, so
`sectionPlayerRuntime.assessmentId` wins over `assessment-id`. The section's
`section-id` is the section identifier; `attempt-id`, `locale` and `debug` travel
as section attributes, and `hooks.cardTitleFormatter` becomes the section's
`hooks`. The section player's [inputs](../section-player/README.md#inputs)
and [runtime configuration](../section-player/README.md#runtime-configuration)
define the keys.

Without a `coordinator`, each section's toolkit builds its own coordinator,
without hooks, and disposes it with the section, so tool state, text-to-speech
and section persistence hooks do not carry across sections. Pass one
`ToolkitCoordinator` to share them. It stays host-owned, and on a section change
the element stops its text-to-speech playback.

## Host methods

The element implements `AssessmentPlayerRuntimeHostContract`:

| Method | Returns |
| --- | --- |
| `getSnapshot()` | `{ readiness, navigation, progress }`, with zero counts before the controller is ready |
| `selectReadiness()` | `{ phase }`: `bootstrapping`, `hydrating`, `ready` or `error` |
| `selectNavigation()` | `currentIndex`, `totalSections`, `canNext`, `canPrevious`, `currentSectionId` |
| `selectProgress()` | `visitedSections`, `totalSections` |
| `navigateTo(indexOrIdentifier)` | `true` when the section changed, and for the current section's identifier |
| `navigateNext()`, `navigatePrevious()` | `true` when the section changed |
| `getAssessmentController()` | The controller handle while connected and ready, else `null` |
| `waitForAssessmentController(timeoutMs = 5000)` | A promise of the handle, or `null` |

Each navigation method first dispatches the cancelable
`assessment-navigation-requested`, before any range check: a request at the last
section carries an out-of-range `toIndex` and no `toSectionId`. A canceled request
returns `false`. Otherwise the method calls the controller and, when the section
changed, `persist()`. The Back and Next buttons call these methods.
`navigateTo(identifier)` reports the current index as its `toIndex`, so read the
target from `toSectionId`; with the current section's identifier it returns `true`
and dispatches nothing.

### Obtaining the handle

```ts
import type { AssessmentPlayerRuntimeHostContract } from "@pie-players/pie-assessment-player";

const player = document.querySelector<HTMLElement & AssessmentPlayerRuntimeHostContract>(
  "pie-assessment-player-default",
);
const controller = await player?.waitForAssessmentController(5000);
```

The handle is ready once initialization and hydration succeed. The getter, the
waiter, `onAssessmentControllerReady` and `assessment-controller-ready` then
observe the same controller. The getter returns `null` before that, after a
failure and after disconnect. A waiter resolves `null` at once on a disconnected
element or one in the error phase, and later when its initialization fails or is
retired or its own timeout expires; the timeout does not cancel the
initialization. Only the newest connected initialization publishes a controller,
UI, event, hook call or error.

### Lifecycle

The element owns its controller. It disposes the controller when an input
rebuilds it or the element disconnects. `dispose()` is idempotent: it removes the
listeners, makes the handle unusable and calls `onAssessmentControllerDispose`. A
host-supplied coordinator stays host-owned; one a section's toolkit built is
disposed with that section.

A failed start shows an error state with a keyboard-accessible Retry button and
dispatches `assessment-error`. The ready hook and the ready event run once per
successful start. The hook is a notification: its rejection reaches `onError`
(phase `controller-init`) and `assessment-error` and leaves the hydrated
assessment ready.

```ts
const unsubscribe = controller?.subscribe((event) => {
  if (event.type === "assessment-route-changed") {
    showPosition(event.currentSectionIndex, event.totalSections);
  }
});

// Saves run in call order. submit() saves first and rejects, unsubmitted, when
// that save fails.
await controller?.persist();
await controller?.submit();
unsubscribe?.();
```

The `session` property takes an `AssessmentSession`. The controller's first
hydrate applies it in place of the strategy's `loadSession`, and the strategy
still receives every save. The value is consumed once: a rebuild for another
reason, such as an `assessment` change, hydrates from the strategy. Assigning a
session whose content equals the controller's, as echoing `getSession()` back on
`assessment-session-changed` does, is a no-op, and so is `null` once the
controller is ready; any other value rebuilds the controller from it. Reading
`session` returns the assigned value until the controller is ready, and a copy of
the controller's session after.

On every section mount the element passes the section's saved snapshot, when the
assessment session holds one, as the section player's `session` property, which
the section's controller applies before `engine-ready`. A section without an
entry hydrates from the section strategy
([Session persistence and submission](#session-persistence-and-submission)).
Until the section reaches `engine-ready`, for up to 5 seconds, the section region
is `aria-busy` and the section `inert`. The element then unlocks it and copies
the section's session into the assessment session on each toolkit
`session-changed`, and once more before navigation replaces the section,
including navigation through the controller. A section that fails or times out
shows a status message, "restore failed" when a snapshot was passed and "load
failed" otherwise, with Retry; it calls `onError` with phase `navigation` and
`{ sectionIdentifier }` and dispatches `assessment-error`, and the saved snapshot
stays intact. This handoff is in memory and acknowledges no durable save.

### Assessment controller

The handle implements `AssessmentControllerHandle`:

| Member | Effect |
| --- | --- |
| `initialize()` | Builds the delivery plan, creates a fresh session and runs `hydrate()`. The element calls it |
| `hydrate()` | Runs `onBeforeAssessmentHydrate`, then applies the assigned or loaded session and emits `assessment-session-applied` when there was one |
| `persist()` | Saves through the strategy, queued in call order. A failure reaches `onError` (`session-save`) and the promise resolves |
| `submit()` | Saves, then marks the assessment submitted and emits `assessment-submission-state-changed`. A failed save reaches `onError` and rejects, and the assessment stays unsubmitted |
| `getSession()` | The controller's live `AssessmentSession`, the shape the strategy exchanges; `null` once disposed |
| `getRuntimeState()` | `readiness`, `currentSectionIndex`, `totalSections`, `currentSectionId`, `canNext`, `canPrevious`, `visitedSections`, `submitted`, for chrome and diagnostics |
| `navigateTo(indexOrIdentifier)`, `navigateNext()`, `navigatePrevious()` | Move, emitting `assessment-route-changed`, `assessment-session-changed` and `assessment-progress-changed`; `false` for an index out of range or an unknown identifier |
| `subscribe(listener)` | Delivers the [event stream](#event-stream) and returns a disposer |
| `getCurrentSection()`, `getSectionAt(index)` | A delivery-plan entry: `sectionIdentifier`, `section`, `stageIdentifier`, `stageIndex`, `sectionIndex` |
| `getSectionSession(sectionId)` | That section's `SectionControllerSessionState`, or `null` |
| `updateSectionSession(sectionId, session)` | Writes a section snapshot into the assessment session and emits `assessment-session-changed` |
| `dispose()` | Retires the controller ([Lifecycle](#lifecycle)) |

Persist `getSession()`. `getRuntimeState()` is derived and carries no stability
guarantee. Navigation through the controller skips the element's navigation
request and its `persist()`; the element still captures the outgoing section and
remounts.

## Hooks

| Hook | Called |
| --- | --- |
| `cardTitleFormatter(context)` | Forwarded to each section player ([Card titles](#card-titles)) |
| `createAssessmentDeliveryPlan(context, defaults)` | Once per controller, at start. `context` is `{ assessmentId, attemptId, assessment }`; `defaults.createDefaultDeliveryPlan()` flattens the sections into a linear list. A nullish return gets the default |
| `createAssessmentSessionPersistence(context, defaults)` | Once per controller, at the first hydrate or save, and cached. `context` is `{ assessmentId, attemptId }`; `defaults.createDefaultPersistence()` returns the `localStorage` strategy. A nullish return gets the default |
| `onBeforeAssessmentHydrate(context)` | Awaited at the start of each hydrate |
| `onBeforeAssessmentPersist(context, session)` | Awaited before each save, inside the save queue |
| `onAssessmentControllerReady(controller)` | After a successful start; not awaited |
| `onAssessmentControllerDispose(controller)` | On dispose |
| `onError(error, { phase, details })` | On every reported failure |

| `onError` phase | Failure |
| --- | --- |
| `delivery-plan-create` | `createAssessmentDeliveryPlan` threw |
| `session-load` | A hydrate failed: its hook, the persistence factory or `loadSession`. On a published controller the element also retires it, shows the error state and dispatches `assessment-error` |
| `session-save` | A save from `persist()` or `submit()` failed. No DOM event follows |
| `controller-init` | `onAssessmentControllerReady` rejected |
| `controller-dispose` | `onAssessmentControllerDispose` rejected |
| `navigation` | A section failed to load or restore; `details` is `{ sectionIdentifier }` |

## Events

### DOM events

The element dispatches these on itself, bubbling and composed.
`ASSESSMENT_PLAYER_PUBLIC_EVENTS` holds the names.

| Event | Detail | When |
| --- | --- | --- |
| `assessment-controller-ready` | `{ controller }` | After a successful start |
| `assessment-navigation-requested` | `fromIndex`, `toIndex`, `fromSectionId`, `toSectionId`, `reason` (`navigate-to`, `navigate-next`, `navigate-previous`) | Before an element navigation. Cancelable: `preventDefault()` blocks it |
| `assessment-route-changed` | `currentSectionIndex`, `totalSections`, `currentSectionId`, `previousSectionId`, `canNext`, `canPrevious` | After the section changed |
| `assessment-session-applied` | `timestamp` | A hydrate applied an assigned or loaded session |
| `assessment-session-changed` | `timestamp` | The session changed: a move or a section snapshot |
| `assessment-progress-changed` | `visitedSectionCount`, `totalSections` | After every move |
| `assessment-submission-state-changed` | `submitted: true` | `submit()` succeeded |
| `assessment-error` | `{ error }` | A failed start, a failed hydrate of a published controller, a rejected ready hook, or a section that failed to load |

The route, session, progress and submission details are the controller's event
objects, `type` and `timestamp` included. A move arrives in this order, for DOM
and controller listeners alike: `assessment-session-changed` for the outgoing
section's snapshot, `assessment-route-changed`, `assessment-session-changed` for
the position, then `assessment-progress-changed`. The section remounts during
`assessment-route-changed`.

```ts
player?.addEventListener("assessment-navigation-requested", (event) => {
  const { fromSectionId, toSectionId } = (event as CustomEvent).detail;
  if (!isNavigationAllowed(fromSectionId, toSectionId)) event.preventDefault();
});
```

### Event stream

The controller's `subscribe()` delivers `AssessmentControllerEvent`, a union of
`assessment-route-changed`, `assessment-session-applied`,
`assessment-session-changed`, `assessment-progress-changed` and
`assessment-submission-state-changed`, with the payloads in the table above. It
covers assessment-level change only. Section events come from the section player
and its controller, and the coordinator's `subscribeItemEvents` and
`subscribeSectionLifecycleEvents` helpers follow them across sections
([Subscriptions](../section-player/README.md#subscriptions)).

## Session persistence and submission

`createAssessmentSessionPersistence` returns the strategy: `loadSession(context)`,
`saveSession(context, session)` and an optional `clearSession(context)`. The
default strategy stores the session in `localStorage` under
`pie:assessment-controller:v1:{assessmentId}:{attemptId}`. Without an attempt id
it neither reads nor writes, since nothing would tell two learners on one device
apart. Supply a strategy backed by your own store for anything beyond a demo.

A loaded session replaces the controller's wholesale, without a check against the
delivery plan. Saves run one at a time in call order, so an older write never
lands after a newer one. The element calls `persist()` only after its own moves:
a section's answers reach the assessment session on each `session-changed` but
reach the strategy at the next move, `persist()` or `submit()`, so a host that
saves on answers calls `persist()` itself.

`submit()` is local. It saves, then sets `submitted`, which the session does not
record: a reload starts unsubmitted, and navigation still works after submit.
[Authoritative assessment submission](../../docs/prds/assessment-authoritative-submission.md)
proposes a host-confirmed submission.

The section layer persists too. A section with no entry in the assessment
session hydrates from the coordinator's section strategy, by default
`localStorage` keyed by assessment, section and attempt id, and the coordinator
saves the section there before it disposes the section's controller
([Section session persistence](../section-player/README.md#section-session-persistence)).
To make the assessment controller the one owner, pass a coordinator whose
`hooks.createSectionSessionPersistence` returns a strategy that loads and saves
nothing.

## Backend delivery for embedded items

Item delivery against a backend is configured on
`sectionPlayerRuntime.player.backend`. The element passes a deep clone to each
section player, which derives every embedded item player's `backend` from it
([Backend delivery for embedded items](../section-player/README.md#backend-delivery-for-embedded-items)).
The `attempt-id` is an assessment attempt and never becomes
`backend.delivery.assignmentId`; a host that delivers under an assignment sets
`assignmentId` itself. Assessment session persistence stays on
`createAssessmentSessionPersistence`. The item player's
[backend support](../../docs/item-player/backend-support.md) guide covers the
delivery contract.

## Navigation chrome

The chrome shows a localized position label ("Section 2 of 3") and Back and Next
buttons, disabled at the first and last section. The section sits in a region
named by the position label. When focus was inside the element, a section change
returns it to the same button, or the other one when that is disabled, or the
region, and a polite status region announces the new position. Navigation from
the host's own chrome leaves focus with the host and announces nothing, so the
host announces the change.

## Card titles

`hooks.cardTitleFormatter` reaches every mounted section player, the first one
included:

```ts
import type { AssessmentPlayerHooks } from "@pie-players/pie-assessment-player";

const hooks: AssessmentPlayerHooks = {
  cardTitleFormatter: (context) => {
    if (context.kind === "item") return `Question ${Number(context.itemIndex ?? 0) + 1}`;
    if (context.kind === "passage") return "Reading passage";
    return null;
  },
};
```

The section player's [Card titles](../section-player/README.md#card-titles)
lists the context fields; a return that is not a non-empty string keeps the
default title.

## Debug logging

`debug` sets `window.PIE_DEBUG`, the page-wide flag every PIE logger reads.
`debug="true"` enables it; `"false"`, `"0"` and an empty value disable it, so a
bare `debug` attribute turns logging off. The value is also set as each section
player's `debug` attribute when the section mounts.

## Instrumentation

The element forwards its DOM events to an `InstrumentationProvider` under the
same names with a `pie-` prefix (`assessment-route-changed` becomes
`pie-assessment-route-changed`), with `instrumentationLayer: "assessment"`,
`assessmentId` and `attemptId` attached. The provider is
`sectionPlayerRuntime.player.loaderConfig.instrumentationProvider`, the one the
section and item players use, and the bridge re-attaches when
`sectionPlayerRuntime` changes.
[Instrumentation providers](../../docs/architecture/instrumentation-providers.md#provider-resolution)
sets out how an unset, `null` or invalid provider resolves.
`CompositeInstrumentationProvider` combines providers, such as a production one
and `DebugPanelInstrumentationProvider`.

Section and toolkit events keep their own streams. The toolkit's operational
events, forwarded when the toolkit is mounted, are listed in
[Instrumentation providers](../../docs/architecture/instrumentation-providers.md#operational-events).

## Preloaded elements

With `player-type="preloaded"` (or `playerType = "preloaded"`) the section
players load no element code, and their pre-warm asserts that every tag the
content names is registered. The host registers the elements with
`registerPreloadedElements` from `@pie-players/pie-item-player/preloaded`
before the assessment player mounts:

```ts
import { registerPreloadedElements } from "@pie-players/pie-item-player/preloaded";
import * as delivery from "@pie-element/multiple-choice/browser/delivery";
import * as controller from "@pie-element/multiple-choice/browser/controller";
import manifest from "../package.json"; // pins "@pie-element/multiple-choice" exactly

registerPreloadedElements(
  [
    {
      tag: "pie-element-multiple-choice",
      package: "@pie-element/multiple-choice",
      version: manifest.dependencies["@pie-element/multiple-choice"],
      element: delivery,
      controller,
    },
  ],
  { math: { assetRoot: "https://assets.example.com/npm" } },
);
```

A tag missing at pre-warm leaves the section's items unmounted and raises a
non-recoverable `element-preload` framework error. Item players count as hosted
under `sectionPlayerRuntime.player.hosted` or an enabled
`sectionPlayerRuntime.player.backend.delivery`, and then need no `controller`.
Version pins, element sets, MathJax assets and TypeScript setup are in
[Registering elements from npm](../../docs/item-player/loading-strategies.md#registering-elements-from-npm).

## Shell element

`pie-assessment-player-shell` takes a `show-navigation` attribute and renders a
`navigation` slot and a default slot. It has no shadow root and clears its
content on every render, so it deletes any children a host gives it, and its
light-DOM slots project nothing. It is unusable for composition as published. A
host that needs its own chrome builds it around a section player, as
[Building a Multi-Section Player](../../docs/assessment-player/integration-guide.md)
does.

## Content trust boundary

Item and passage markup reaches the DOM through `<pie-item-player>`, which
sanitizes it with DOMPurify by default. The
[item player README](../item-player/README.md#content-trust-boundary) covers the
allow-list, the `trust-markup` opt-out and the `sanitizeMarkup` override. Set
`sectionPlayerRuntime.player.trustMarkup` or
`sectionPlayerRuntime.player.sanitizeMarkup` here: the assessment player passes
that runtime to each section player, which forwards `runtime.player` fields to
its item players
([section player trust boundary](../section-player/README.md#content-trust-boundary)).
The [security model](../../docs/security/readme.md) covers the trust boundary
across the players.

## Exports

| Entry | Contents |
| --- | --- |
| `@pie-players/pie-assessment-player` | Registers both elements. Exports `ASSESSMENT_PLAYER_PUBLIC_EVENTS` and the types of the inputs, hooks, host contract, controller handle, controller events, event details, delivery plan and persistence strategy |
| `@pie-players/pie-assessment-player/components/assessment-player-default-element` | An alias of the root entry |

The `AssessmentController` class is internal: hosts reach a controller through
the element.
