# M7 Pre-Flight Audit — Adjustment A1

> **Status:** complete; rip-out posture cleared for PR 5.
> **Scope:** the four downstream surfaces named in `m7-implementation-plan.md` § 1.1.
> **Question:** does any consumer subscribe to engine-emitted DOM events
> (`pie-stage-change`, `framework-error`, `pie-loading-complete`,
> `readiness-change`, `interaction-ready`, or the legacy `ready`) on a nested
> `<pie-assessment-toolkit>` element rather than on the outer layout CE
> (`<pie-section-player-*>` / `<pie-assessment-player-default>`)?
>
> **Branch note for FixedFormPlayer.** The audit was first run against
> `../element-QuizEngineFixedFormPlayer/` while that working copy was
> checked out on a placeholder branch (only `README.md` committed). The
> live consumer source lives on the `pie-assessment-toolkit-demo` branch
> of the same repo; the audit was rerun against that branch and the
> findings below reflect that source.

## Audit method

For each surface the audit ran two ripgrep passes:

1. Tag-level: `<pie-assessment-toolkit` and `<pie-section-player` to locate
   every CE instantiation.
2. Handler-level: the union of canonical engine event names plus the
   declarative attribute forms `onFrameworkError`, `onPieStageChange`,
   `onPieLoadingComplete`, `onReadinessChange`, `onInteractionReady`, and
   any `addEventListener('<event>', …)` call carrying one of those names.

A consumer is flagged only if both:

- it instantiates `<pie-assessment-toolkit>` directly (i.e. nests it under a
  layout CE), **and**
- it attaches one of the engine events on that nested element.

## Categorization

| Category | Meaning | M7 implication |
|---|---|---|
| **rip-out-safe** | No nested `<pie-assessment-toolkit>` listeners; consumer talks only to the outer layout CE or to the coordinator API. PR 5 (kernel switch) cannot regress it. | none |
| **requires-migration** | Consumer attaches an engine event on a nested `<pie-assessment-toolkit>`. Will lose that event after PR 5/6 because the engine moves to the kernel and the nested toolkit no longer re-emits it. | listed in M7 changeset; consumer migrates within the same release window |
| **requires-dual-emit-window** | Same as above but cannot migrate in the same release window. | escalate to maintainer; PR 5 blocks until migration plan is on file |
| **needs-confirmation** | Surface is referenced by the plan but not auditable from this checkout (e.g. only a stub README + empty `dist/` is present locally; real source lives in a remote repo not mirrored here). | maintainer confirms by inspecting the upstream source before PR 5 lands |

## Findings

### `apps/section-demos/src/routes/(demos)/**/*.svelte`

**Verdict:** rip-out-safe.

- Every demo embeds `<pie-section-player-vertical>` / `-splitpane` /
  `-tabbed`. None embed `<pie-assessment-toolkit>` directly.
- The only engine-event handler in the surface is in
  `invalid-tools-config/+page.svelte`:

  ```50:50:apps/section-demos/src/routes/(demos)/invalid-tools-config/+page.svelte
  		(playerEl as any).onFrameworkError = handleFrameworkError;
  ```

  `playerEl` is a `<pie-section-player-splitpane>` (the outer layout CE) —
  not a nested toolkit. PR 5's kernel-side engine continues to emit
  `framework-error` from the outer CE, so this consumer is unaffected.
- Other listeners in the surface (`item-session-changed`,
  `session-changed`, dialog `close`, `focusin`/`focusout`, scroll/resize,
  `keydown`) are outside the engine event surface and are unaffected by M7.

### `apps/assessment-demos/src/routes/(demos)/**/*.svelte`

**Verdict:** rip-out-safe.

- The two demo pages (`three-section-assessment`, `session-hydrate-db`) embed
  `<pie-assessment-player-default>` and the section-player tools debugger
  CEs. Neither nests `<pie-assessment-toolkit>`.
- `addEventListener` calls on `playerRef` (the
  `<pie-assessment-player-default>` outer CE) target only
  `ASSESSMENT_PLAYER_PUBLIC_EVENTS.routeChanged` /
  `.sessionChanged`, e.g.:

  ```254:261:apps/assessment-demos/src/routes/(demos)/three-section-assessment/+page.svelte
  		playerRef.addEventListener(
  			ASSESSMENT_PLAYER_PUBLIC_EVENTS.routeChanged,
  			onRouteChanged as EventListener,
  		);
  		playerRef.addEventListener(
  			ASSESSMENT_PLAYER_PUBLIC_EVENTS.sessionChanged,
  			onRouteChanged as EventListener,
  		);
  ```

  Those are assessment-player public events, not engine events; they survive
  M7 unchanged.
- Searches for any of the engine event names in this surface returned zero
  matches.

### `apps/item-demos/src/routes/**/*.svelte`

**Verdict:** rip-out-safe.

- This surface only hosts item-level players (`<pie-item-player-*>`). It
  does not embed `<pie-section-player-*>` or `<pie-assessment-toolkit>`.
- The only `pie-section-*` reference is the
  `<pie-section-player-tools-instrumentation-debugger>` overlay, which is a
  developer-tooling CE that talks to broadcasts, not a section/toolkit
  consumer.
- Searches for any engine event name returned zero matches.

### External: `../element-QuizEngineFixedPlayer/`

**Verdict:** rip-out-safe.

- Single CE host: `pie-section-wrapper.component.html` embeds
  `<pie-section-player-splitpane>` only:

  ```2:13:../element-QuizEngineFixedPlayer/projects/quiz-engine-fixed-player/src/app/components/pie-section-wrapper/pie-section-wrapper.component.html
  <pie-section-player-splitpane
      [runtime]="sectionPlayerRuntime"
      [section]="activeSection"
      [attr.section-id]="sectionId"
      [attr.attempt-id]="attemptId"
      show-toolbar="false"
      (toolkit-ready)="handleToolkitReady($event)"
      debug="false"
      [hooks]="sectionPlayerHooks"
      [style.--pie-section-player-card-header-background]="themeHeaderColor"
      class="theme-layout__player"
  ></pie-section-player-splitpane>
  ```

- `handleToolkitReady` listens to `toolkit-ready` on the outer CE and uses
  the coordinator API (`coordinator.subscribeItemEvents`,
  `coordinator.subscribeSectionLifecycleEvents`). No engine DOM-event
  handlers attach to a nested `<pie-assessment-toolkit>`, and no
  `<pie-assessment-toolkit>` tag exists anywhere in the project source.
- The other `addEventListener` calls (resize / pixel-ratio / visualViewport
  in `theme.service.ts`, plus a static LTI test page and minified
  new-relic bundle) are unrelated.

### External: `../element-QuizEngineFixedFormPlayer/` (`pie-assessment-toolkit-demo` branch)

**Verdict:** rip-out-safe.

- The Angular project at
  `projects/quiz-engine-fixed-form-player/src/app/` consists of one demo
  page per scenario (`basic`, `language-arts`, `math-calculator`,
  `math-title-override`, `desmos-custom-auth`, `polly-default`,
  `polly-custom-backend`, `schoolcity-tts`, `section-header-theme`,
  `session-backend`). Every page template embeds the **outer**
  `<pie-section-player-splitpane>` CE and only the outer one — none nest
  `<pie-assessment-toolkit>`. Some pages also render
  `<pie-section-player-tools-session-debugger>` /
  `<pie-section-player-tools-event-debugger>` panels, which are
  developer-tooling CEs, not consumers of the engine event surface.
- Each page wires `(toolkit-ready)="handleToolkitReady($event)"` on the
  outer CE. `handleToolkitReady` extracts the coordinator from the event
  detail and uses the coordinator API
  (`coordinator.subscribeItemEvents`,
  `coordinator.subscribeSectionLifecycleEvents`) to subscribe to
  section-controller events, e.g.:

  ```53:82:../element-QuizEngineFixedFormPlayer/projects/quiz-engine-fixed-form-player/src/app/basic-page.component.ts
    handleToolkitReady(event: Event): void {
      const detail = (event as CustomEvent<{ coordinator?: SectionCoordinator }>).detail;
      const coordinator = detail?.coordinator;
      if (!coordinator?.subscribeItemEvents || !coordinator?.subscribeSectionLifecycleEvents) {
        return;
      }

      this.controllerUnsubscribe?.();
      const itemScopedUnsubscribe = coordinator.subscribeItemEvents({
        sectionId: this.sectionId,
        eventTypes: this.itemScopedEventTypes,
        itemIds: this.sectionControllerItemIds,
        listener: (sectionEvent: unknown) => {
          const type = (sectionEvent as { type?: unknown })?.type;
          console.log('[section-preview] section-controller event', type, sectionEvent);
        }
      }) || undefined;
      const sectionScopedUnsubscribe = coordinator.subscribeSectionLifecycleEvents({
        sectionId: this.sectionId,
        eventTypes: this.sectionScopedEventTypes,
        listener: (sectionEvent: unknown) => {
          const type = (sectionEvent as { type?: unknown })?.type;
          console.log('[section-preview] section-controller event', type, sectionEvent);
        }
      }) || undefined;
      this.controllerUnsubscribe = () => {
        itemScopedUnsubscribe?.();
        sectionScopedUnsubscribe?.();
      };
    }
  ```
- Searches across the project for any of the engine event names, any
  declarative `onFrameworkError` / `onPieStageChange` / `onPieLoadingComplete`
  / `onReadinessChange` / `onInteractionReady` attribute, and any
  `addEventListener(…)` call all return **zero** matches.
- Conclusion: same shape as FixedPlayer — outer-CE consumer using the
  coordinator API for fine-grained section-controller events. PR 5's
  kernel-side engine continues to host the outer CE and continues to
  emit `toolkit-ready`, so this consumer is unaffected.

### External: `../../kds/pie-api-aws/containers/pieoneer/`

**Verdict:** rip-out-safe.

- Pieoneer's section-related routes (`(public)/etl/demos/sections/three-questions`,
  `single-question`; `(fullscreen)/section-preview/[…]`) and the demo
  runtime overlays/components all embed outer layout CEs:
  `<pie-section-player-splitpane>`, `<pie-section-player-vertical>`,
  `<pie-section-player-tools-event-debugger>`,
  `<pie-section-player-tools-instrumentation-debugger>`,
  `<pie-section-player-tools-tts-settings>`,
  `<pie-section-player-tools-pnp-debugger>`,
  `<pie-section-player-tools-session-debugger>`.
- No `<pie-assessment-toolkit>` instantiation anywhere in
  `containers/pieoneer/src`.
- Searches for any engine event name in `containers/pieoneer/src` returned
  zero matches; no `addEventListener('pie-stage-change' | 'framework-error'
  | 'pie-loading-complete' | 'readiness-change' | 'interaction-ready', …)`
  calls exist.

## Summary table

| Surface | Verdict |
|---|---|
| `apps/section-demos` | rip-out-safe |
| `apps/assessment-demos` | rip-out-safe |
| `apps/item-demos` | rip-out-safe |
| `../element-QuizEngineFixedPlayer/` | rip-out-safe |
| `../element-QuizEngineFixedFormPlayer/` (`pie-assessment-toolkit-demo` branch) | rip-out-safe |
| `../../kds/pie-api-aws/containers/pieoneer/` | rip-out-safe |

## Posture decision

Ship M7 PR 5 (kernel switch) under the **rip-out posture** locked in the
implementation plan. No blockers remain.

No `requires-migration` or `requires-dual-emit-window` consumers were
discovered. The dual-emit window is therefore not required for any
consumer the plan identifies as in scope, and PR 7's deletion of the
section-player resolver/readiness/stage-tracker re-exports is unaffected.

If `element-QuizEngineFixedFormPlayer` lands a non-`pie-assessment-toolkit-demo`
production branch before M7 ships, re-run the rg recipes below against
that branch to confirm the verdict still holds.

## Reproducing the audit

From repo root, with the sibling repos at the paths called out in the
implementation plan:

```sh
# tag-level scan
rg -n '<pie-(assessment-toolkit|section-player)' \
   apps/{section-demos,assessment-demos,item-demos}/src \
   ../element-QuizEngineFixedPlayer/projects \
   ../element-QuizEngineFixedFormPlayer/projects \
   ../../kds/pie-api-aws/containers/pieoneer/src

# handler-level scan (canonical event names + declarative attribute forms)
rg -n 'pie-stage-change|framework-error|pie-loading-complete|readiness-change|interaction-ready|onFrameworkError|onPieStageChange|onPieLoadingComplete|onReadinessChange|onInteractionReady' \
   apps/{section-demos,assessment-demos,item-demos}/src \
   ../element-QuizEngineFixedPlayer/projects \
   ../element-QuizEngineFixedFormPlayer/projects \
   ../../kds/pie-api-aws/containers/pieoneer/src

# imperative addEventListener form on the engine event names
rg -n "addEventListener\(\s*['\"](pie-stage-change|framework-error|pie-loading-complete|readiness-change|interaction-ready)" \
   apps \
   ../element-QuizEngineFixedPlayer \
   ../element-QuizEngineFixedFormPlayer \
   ../../kds/pie-api-aws/containers/pieoneer
```

Re-run the audit if any of those surfaces lands a new
`<pie-assessment-toolkit>` instantiation before M7 PR 5 ships.
