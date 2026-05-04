# PIE Assessment Player

`@pie-players/pie-assessment-player` provides assessment-level orchestration custom elements.

It coordinates section flow and assessment session state while delegating section rendering to `@pie-players/pie-section-player` and shared services to `@pie-players/pie-assessment-toolkit`.

Primary entrypoint:

- `@pie-players/pie-assessment-player`

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

`waitForAssessmentController(timeoutMs)` resolves once the controller has
been wired (the same signal the
`AssessmentPlayerHooks.onAssessmentControllerReady(controller)` hook fires
on). Use `getAssessmentController()` if you've already passed the readiness
anchor synchronously.

### Lifecycle

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

### Event stream

The controller's typed event stream
(`AssessmentControllerEvent` discriminated union) covers assessment-level
change only — section-level events flow through the embedded
`SectionController` and the toolkit coordinator's
`subscribeItemEvents` / `subscribeSectionLifecycleEvents` helpers.

- `assessment-route-changed` — section-level navigation moved (index / id,
  `previousSectionId`, `canNext` / `canPrevious`).
- `assessment-session-applied` — `hydrate()` loaded a persisted session.
- `assessment-session-changed` — assessment session mutated (navigation,
  per-section snapshot upsert).
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

## Content trust boundary

Assessment markup reaches the DOM via the underlying
`<pie-item-player>` element, which now sanitizes item / passage markup by
default through DOMPurify. See
[pie-item-player README](./README.md#content-trust-boundary)
for the allow-list, opt-out mechanics (`trust-markup`), and the
`sanitizeMarkup` property override. Assessment-player hosts forward these
settings by setting `runtime.player.trustMarkup` /
`runtime.player.sanitizeMarkup` on the shared runtime they pass into the
section-player instances; the section-player runtime flattens `runtime.player.*`
fields onto the embedded `<pie-item-player>` (see the section-player README
for the exact forwarding shape).
