# PIE Assessment Player

`@pie-players/pie-assessment-player` provides assessment-level orchestration custom elements.

It coordinates section flow and assessment session state while delegating section rendering to `@pie-players/pie-section-player` and shared services to `@pie-players/pie-assessment-toolkit`.

Primary entrypoint:

- `@pie-players/pie-assessment-player`

The entry is bundler-only: it imports the toolkit, players-shared and the
section player by bare specifier.

## AssessmentController

`AssessmentController` is the domain authority for an assessment attempt. It
owns cross-section navigation, the assessment session shape (delivery plan +
per-section snapshots), and `submit()`. Per-section concerns (in-section
navigation, item sessions, content loading) belong to the embedded
`SectionController` exposed by `@pie-players/pie-section-player`. See
[`docs/assessment-player/client-architecture-tutorial.md`](../../docs/assessment-player/client-architecture-tutorial.md)
for the end-to-end walkthrough.

The handle implements `AssessmentControllerHandle` (defined in
`packages/assessment-player/src/controller/AssessmentController.ts`); see
the JSDoc on that interface for the per-method contract.

### Obtaining the handle

Two equivalent paths:

```ts
const host = document.querySelector("pie-assessment-player-default") as any;
const controller =
  (await host?.waitForAssessmentController?.(5000)) ??
  host?.getAssessmentController?.();
```

`waitForAssessmentController(timeoutMs)` resolves after initialization and
hydration succeed. At that point the getter, ready hook, and ready event all
observe the same controller. The getter returns `null` while initialization is
pending or failed, and after disconnect. A waiter resolves to `null` when its
active attempt fails or is retired, or its own timeout expires. A waiter's
timeout does not cancel a still-active initialization.

Connect the element and assign `assessmentId`, `attemptId`, `assessment`,
`hooks` and `session` in the same turn, or assign them before connecting. These
assignments are batched; changing assessment, attempt, hooks or session later
retires the previous controller and starts a new one. Replace object properties to update them;
mutating a previously assigned object in place is not an update signal. Runtime
props, locale, and navigation visibility do not reload the assessment.

Failed initialization exposes an error and a keyboard-accessible Retry action.
The element invokes the ready hook and emits the ready event once per successful
initialization. Ready hooks are notifications: their rejection reaches `onError`
and `assessment-error` without undoing successful hydration.

### Lifecycle

The element owns its assessment controller and calls its idempotent `dispose()`
when inputs replace the attempt or the element disconnects. Disposal removes
listeners and makes the old handle unusable. The nested toolkit disposes any
coordinator it created; a coordinator supplied by the host remains host-owned.

```ts
// hydrate runs as part of initialize(); call it again only on a manual reload.
const unsubscribe = controller.subscribe(handleEvent);

// host-driven navigation:
controller.navigateTo("section-2");
controller.navigateNext();
controller.navigatePrevious();

// persist on whatever cadence the host wants; submit() always persists.
await controller.persist();
await controller.submit();
unsubscribe();
```

`getSession()` returns the current `AssessmentSession` snapshot — the same
shape the persistence strategy load/save methods exchange and the same
shape per-section bridges roll up into via `updateSectionSession(sectionId,
snapshot)`.

The element's `session` property takes that shape too. The controller's first
hydrate applies an assigned session in place of the strategy's `loadSession`;
the strategy still receives every `persist()`. The value is consumed once: a
rebuild for another reason, such as an `assessment` change, hydrates from the
strategy. Assigning a session equal to the controller's, as writing
`assessment-session-changed` back into the property does, is a no-op, and so is
`null` once the controller is ready. Reading `session` returns the assigned value
until the controller is ready and a copy of the controller's session after.

The default element captures the outgoing section before navigation replaces it,
including navigation through the controller. A returning section receives its
saved section snapshot as the section player's `session` property, which its
controller applies before the canonical `engine-ready` stage; the section accepts
input and session updates from `engine-ready` on. The section region stays `aria-busy` during
this handoff. Failed restoration leaves the saved snapshot intact, reports
`assessment-error` and `onError` with phase `navigation`, and offers Retry.
Navigating away or disconnecting retires that handoff. This in-memory restoration
does not acknowledge durable saves; persistence still uses the host's strategy.

### Event stream

The controller's typed event stream
(`AssessmentControllerEvent` discriminated union) covers assessment-level
change only — section-level events flow through the embedded
`SectionController` and the toolkit coordinator's
`subscribeItemEvents` / `subscribeSectionLifecycleEvents` helpers.

- `assessment-route-changed` — section-level navigation moved (index / id,
  `previousSectionId`, `canNext` / `canPrevious`).
- `assessment-session-applied` — `hydrate()` applied a session, persisted or
  assigned as `session`.
- `assessment-session-changed` — assessment session mutated (navigation,
  per-section snapshot upsert). The active section's snapshot is upserted once
  for each `session-changed` it emits.
- `assessment-progress-changed` — visited-section count flipped.
- `assessment-submission-state-changed` — `submit()` recorded the final
  state.

The same assessment event names are also emitted as DOM events on the player
chrome. The instrumentation bridge forwards those DOM events under the
`pie-assessment-*` provider event names documented in
[Instrumentation and observability](#instrumentation-and-observability).

## Debug logging

Assessment-player now exposes a `debug` option on `pie-assessment-player-default`.

- Enable verbose debug logs: `<pie-assessment-player-default debug="true">`
- Disable verbose debug logs: `<pie-assessment-player-default debug="false">` (or `debug="0"`)

The setting is forwarded to the rendered section-player instance and also applies
the global flag (`window.PIE_DEBUG`) for shared runtime logging behavior.

## Card Title Formatter

Use the existing `hooks` registration surface on `pie-assessment-player-default`.
The callback is forwarded to each rendered section-player instance, including the
initially mounted section (for example when launching directly into section 2).

```ts
const host = document.querySelector("pie-assessment-player-default") as any;
host.hooks = {
  ...(host.hooks || {}),
  cardTitleFormatter: (context: Record<string, unknown>) => {
    if (context.kind === "item") {
      const itemIndex = Number(context.itemIndex ?? 0) + 1;
      return `Question ${itemIndex}`;
    }
    if (context.kind === "passage") {
      return "Reading passage";
    }
    return typeof context.defaultTitle === "string" ? context.defaultTitle : "";
  },
};
```

Component registration entrypoints:

- `@pie-players/pie-assessment-player/components/assessment-player-default-element`
- `@pie-players/pie-assessment-player/components/assessment-player-shell-element`

## Instrumentation and observability

Assessment-player instrumentation is provider-agnostic and built on the shared
`InstrumentationProvider` contract used across players.

Canonical provider injection paths:

- `sectionPlayerRuntime.player.loaderConfig.instrumentationProvider`

Provider semantics:

- With `trackPageActions: true`, missing/`undefined` provider values use the default New Relic provider path.
- `instrumentationProvider: null` explicitly disables instrumentation.
- Invalid provider objects are ignored (optional debug warning), also no-op.
- Existing `item-player` behavior remains the compatibility anchor.
- To keep production telemetry while debugging, use `CompositeInstrumentationProvider`
  with `NewRelicInstrumentationProvider` and `DebugPanelInstrumentationProvider`.
- Toolkit telemetry forwarding uses the same provider path, so tool/backend
  operational events appear in production providers and debug overlays.

Assessment-player owned canonical stream:

- `pie-assessment-controller-ready`
- `pie-assessment-navigation-requested`
- `pie-assessment-route-changed`
- `pie-assessment-session-applied`
- `pie-assessment-session-changed`
- `pie-assessment-progress-changed`
- `pie-assessment-submission-state-changed`
- `pie-assessment-error`

Ownership boundary: assessment-player owns assessment semantics only. Section
and toolkit semantics remain in their own streams to avoid overlap. Bridge
dedupe is a safety net, not the primary correctness mechanism.

Toolkit tool/backend operational stream (when toolkit is mounted):

- `pie-tool-init-start|success|error`
- `pie-tool-backend-call-start|success|error`
- `pie-tool-library-load-start|success|error`

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

registerPreloadedElements([
  {
    tag: "pie-element-multiple-choice",
    package: "@pie-element/multiple-choice",
    version: manifest.dependencies["@pie-element/multiple-choice"],
    element: delivery,
    controller,
  },
]);
```

- A tag missing at pre-warm leaves the section's items unmounted and raises a
  non-recoverable `element-preload` framework error.
- Install element packages with `npm install --save-exact`. npm otherwise saves
  a caret range, which registration rejects as a `version`, and which a fresh
  install can resolve to another release line: `^13.4.0-next.15` resolves to
  the legacy `13.4.4`, which has no `./browser/*` modules.
- Install every pie-elements-ng package from one release, in one install from
  the same dist-tag, and upgrade them together. Elements whose `./browser/*`
  builds typeset on `window.MathJax` share the MathJax the first of them loads,
  in the build and configuration of that element's release, so in a mixed set
  an element can typeset with a MathJax it was not built for. Elements that
  bundle their own MathJax share none
  ([One MathJax version per page](../../docs/item-player/loading-strategies.md#one-mathjax-version-per-page)).
- Register one version per package; registering a second version throws.
- Register each package's `controller` unless the item players are hosted
  (`sectionPlayerRuntime.player.hosted`, or an enabled
  `sectionPlayerRuntime.player.backend.delivery`). A player that is not hosted
  runs `model()` in the browser and warns for each tag registered without one.
- Only `@pie-element/*` builds from pie-elements-ng publish
  `./browser/delivery` and `./browser/controller`.
- Under TypeScript, the `package.json` import needs `resolveJsonModule`, and a
  package version that ships no declarations for `./browser/*` needs a
  `declare module` shim for those subpaths.

See [`strategy="preloaded"`](../../docs/item-player/loading-strategies.md#strategypreloaded)
for the registration contract.

## Content trust boundary

Assessment markup reaches the DOM via the underlying
`<pie-item-player>` element, which now sanitizes item / passage markup by
default through DOMPurify. See the
[pie-item-player README](../item-player/README.md#content-trust-boundary)
for the allow-list, opt-out mechanics (`trust-markup`), and the
`sanitizeMarkup` property override. Assessment-player hosts forward these
settings by setting `sectionPlayerRuntime.player.trustMarkup` /
`sectionPlayerRuntime.player.sanitizeMarkup` on the assessment player; it passes
that runtime to each section player, whose runtime flattens `runtime.player.*`
fields onto the embedded `<pie-item-player>` (see the section-player README
for the exact forwarding shape).
