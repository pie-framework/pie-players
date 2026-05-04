# Documentation & Code Gaps — Fix Plan

This plan records gaps identified while preparing and reviewing external-facing
architecture documentation for the Section Player and Assessment Toolkit.

Items 2–6 are documentation/JSDoc changes only. Item 1 is a public-API
removal (deleting the unused `TypedEventBus`); it does not affect runtime
behavior because nothing inside the toolkit uses it, but it is a public
export and therefore a `patch` changeset.

---

## Background

While building a presentation on the Section Player and Assessment Toolkit,
several documentation gaps and one misleading piece of internal code surfaced.
This document captures them so they can be addressed as a coherent batch.

---

## 1. TypedEventBus — delete (unused public API)

**Files:**

- `packages/assessment-toolkit/src/core/TypedEventBus.ts` (the implementation)
- `packages/assessment-toolkit/tests/typed-event-bus.test.ts` (tests for the
  wrapper itself)
- `packages/assessment-toolkit/src/index.ts` (public export at line 14)
- `packages/assessment-toolkit/README.md` (line ~760 building-block bullet)
- `apps/docs/src/routes/+page.svelte` (marketing-docs card around line 339)
- `docs/evals/assessment-toolkit/event-contracts/evals.yaml`
  (`underTest: "TypedEventBus + event contracts"` — the eval body never
  references the class)
- `packages/assessment-toolkit/src/services/I18nService.ts` (line 13 JSDoc
  bullet `"TypedEventBus integration: Emit locale change events"`)

**Gap:**

`TypedEventBus` is a ~80-LOC `EventTarget` wrapper exported from the toolkit
as a "building block". It is **not used anywhere inside the toolkit**, and the
toolkit's actual event surfaces deliberately do not adopt it:

- Controller streams use `controller.subscribe(listener)` returning a disposer
  and dispatching a strongly-typed discriminated union
  (`SectionControllerEvent` in `section-controller-types.ts`). One subscribe,
  many event types — `TypedEventBus.on<K extends keyof EventMap>` is the
  wrong shape.
- `ToolkitCoordinator.subscribeSectionEvents` /
  `subscribeItemEvents` / `subscribeSectionLifecycleEvents` use the same
  disposer + filtered fan-out shape as the controllers.
- `FrameworkErrorBus`
  (`packages/assessment-toolkit/src/services/framework-error-bus.ts`) is a
  hand-rolled bus with a documented design contract — synchronous fan-out,
  listener isolation (a throwing listener does not break fan-out), snapshot
  iteration, idempotent unsubscribe, no replay. `EventTarget` provides none
  of those guarantees.
- `I18nService` uses `Set<() => void>` and intentionally does not bubble
  through the DOM — a locale change should not be dispatched as a composed
  `CustomEvent` that bubbles past every shadow boundary up to `document`.
- DOM `CustomEvent`s on `<pie-assessment-toolkit>` are how the toolkit talks
  to its host; they are typed via the constants in
  `packages/assessment-toolkit/src/runtime/registration-events.ts`.

The README and docs-site card are already on the defensive about why the bus
isn't used. Hosts that want this pattern can write the equivalent ~30 lines
in five minutes; we don't need to maintain it as public API. The misleading
`I18nService` JSDoc bullet is a symptom of the same confusion.

**Recommended fix:**

1. Delete `packages/assessment-toolkit/src/core/TypedEventBus.ts` and the
   accompanying `tests/typed-event-bus.test.ts`.
2. Remove the public re-export from `packages/assessment-toolkit/src/index.ts`.
3. Remove the README "Core Infrastructure" bullet for `TypedEventBus` and the
   marketing-docs card.
4. Rewrite the `event-contracts` eval `underTest` to describe what the eval
   actually verifies (`player:session-changed` shows up in the host log); the
   eval body does not reference `TypedEventBus`.
5. Remove the `* - TypedEventBus integration: Emit locale change events`
   line from the `I18nService` JSDoc. No `TODO:` placeholder — there is no
   pending work.
6. This is a public-API removal from `@pie-players/pie-assessment-toolkit`.
   Add a `.changeset/*.md` (`patch` per the lockstep policy) so consumers see
   the removal in `CHANGELOG.md`.

---

## 2. SectionControllerHandle — add JSDoc to the interface

**File:** `packages/assessment-toolkit/src/services/section-controller-types.ts`

**Gap:**  
`SectionControllerHandle` is the primary API surface that host applications
interact with after receiving the `toolkit-ready` event.  The interface itself
has no JSDoc, and none of its methods are documented:

| Method | Has JSDoc? |
|---|---|
| `initialize()` | No |
| `updateInput()` | No |
| `hydrate()` | No |
| `persist()` | No |
| `dispose()` | No |
| `subscribe()` | No |
| `getRuntimeState()` | No |
| `getSession()` | No |
| `applySession()` | No |
| `updateItemSession()` | No |
| `configureSessionPersistence()` | No |

This interface lives in the assessment-toolkit package, which is the canonical
source of the host-facing contract.

**Recommended fix:**  
Add a JSDoc block to the `SectionControllerHandle` interface and a one-liner
to each of its methods describing purpose, when to call it, and what it
returns.  `getSession()` in the concrete `SectionController` implementation
already has a well-worded doc comment — use it as a template.

---

## 3. AssessmentControllerHandle — same gap as SectionControllerHandle

**File:** `packages/assessment-player/src/controller/AssessmentController.ts`
(line 53). The interface lives inline alongside `AssessmentControllerEvent`
and `AssessmentControllerRuntimeState`; there is no separate
`assessment-controller-types.ts` file.

**Gap:**  
`AssessmentControllerHandle` has 14 public methods (`initialize`, `hydrate`,
`persist`, `getSession`, `getRuntimeState`, `navigateTo`, `navigateNext`,
`navigatePrevious`, `submit`, `subscribe`, `getCurrentSection`,
`getSectionAt`, `getSectionSession`, `updateSectionSession`) with no JSDoc on
the interface or any of its members.

**Recommended fix:**  
Same treatment as SectionControllerHandle above — JSDoc the interface and
each method in place.

**Optional follow-up (out of scope for this batch):** the section side has a
dedicated `section-controller-types.ts` re-exported from the assessment
toolkit; the assessment side does not. Whether to extract the assessment
types into their own file (and whether to re-export them from the toolkit
for full symmetry) is a refactor decision worth its own change set.

---

## 4. section-player README — add a Controllers section

**File:** `packages/section-player/README.md`

**Gap:**  
The section-player README covers CE properties, layout variants, instrumentation,
and focus management well.  It does not mention `SectionController` at all —
not what it owns, not how to obtain a handle, not the public API.

Yet the `SectionControllerHandle` surface (`hydrate`, `persist`, `getSession`,
`subscribe`) is the primary way a host manages session state and listens for
navigation events.  A new integrator reading the README would not know it exists.

**Recommended fix:**  
Add a `## SectionController` section that covers:
- What it owns (in-section navigation state, item session aggregation, persistence)
- How to obtain the handle (`getSectionController()` / `waitForSectionController()`)
- The session lifecycle (`configureSessionPersistence` → `hydrate` → `subscribe` → `persist`)
- The typed event stream (key events: `item-selected`, `item-session-data-changed`,
  `content-loaded`, `section-loading-complete`)

The `docs/section-player/client-architecture-tutorial.md` already explains this
well — the README section can be a short summary with a pointer to that guide.

---

## 5. assessment-player README — add a Controllers section

**File:** `packages/assessment-player/README.md`

**Gap:**  
The assessment-player README (103 lines) covers debug logging, card title
formatter, instrumentation, and the content trust boundary.  It does not mention
`AssessmentController` at all — not the handle, not `submit()`, not the event
stream.

**Recommended fix:**  
Same treatment as the section-player README above: add a concise `## AssessmentController`
section covering ownership (cross-section navigation, assessment session, `submit()`),
how to obtain the handle, and the key event types.

---

## 6. controller-boundaries.md — move or cross-link to be discoverable

**File:** `packages/section-player/src/controllers/controller-boundaries.md`

**Gap:**  
This file contains an excellent, concise statement of controller boundaries
("SectionController is the domain authority … Custom elements are transport
adapters only.") and explains why the section player does not instantiate
per-item controller instances.  But it lives in `src/controllers/`, not in
a location a new team member would naturally look.

**Recommended fix:**  
Either:
- Move it to `docs/section-player/controller-boundaries.md` and add a link
  from the section-player README, or
- Add a reference to it in the section-player README's `## SectionController`
  section so developers can find the design rationale.

No content needs to change — just discoverability.

---

## Priority

| # | Item | Effort | Impact |
|---|---|---|---|
| 2 | JSDoc on `SectionControllerHandle` | Small | High — it's the host's primary API surface |
| 3 | JSDoc on `AssessmentControllerHandle` | Small | High |
| 4 | section-player README — Controllers section | Small | High |
| 5 | assessment-player README — Controllers section | Small | Medium |
| 1 | Delete unused `TypedEventBus` (and its export, test, README/docs-site references, eval `underTest`, and stale I18nService JSDoc bullet) | Small | Medium (removes unused public API and the confusion around it) |
| 6 | Promote controller-boundaries.md | Tiny | Low (discoverability) |
