# Session Property For The Section And Assessment Players

Status: Accepted, 2026-10-06

Owner: PIE Players maintainers

Related architecture:

- [Item player session management](../item-player/overview.md#session-management)
- [Section player client architecture](../section-player/client-architecture-tutorial.md)
- [Section controller boundaries](../section-player/controller-boundaries.md)
- [Assessment player client architecture](../assessment-player/client-architecture-tutorial.md)
- [Assessment player lifecycle and persistence plan](../architecture/assessment-player-lifecycle-persistence-implementation-plan.md)
- [Consumer API dependencies](../integrations/consumer-api-dependencies.md)

## Problem

`<pie-item-player>` takes its session as a property. The section player layout
elements and `<pie-assessment-player-default>` take their content as a property
(`section`, `assessment`) and have no session input. A session enters only
through a persistence strategy's `loadSession`, or through the controller after
it is published: `waitForSectionController` then `applySession` for a section,
`updateSectionSession` for one section of an assessment. A host moving from
item-level to section-level delivery therefore trades a property binding for an
imperative restore sequence, and inherits that sequence's race.

The coordinator creates a section controller and runs `configureSessionPersistence`,
`initialize` and `hydrate` before publishing it
(`packages/assessment-toolkit/src/services/ToolkitCoordinator.ts:1894-1950`), and
publishing schedules the first composition
(`packages/assessment-toolkit/src/runtime/SectionRuntimeEngine.ts:376`). A host's
`applySession` at `toolkit-ready` or `engine-ready` races that schedule's flush
(`composition-emit-scheduler.ts`). Both in-repo restorers guarded it by hand: the
assessment player kept the section `inert` and `aria-busy` until its
post-`engine-ready` `applySession` resolved, and the backend demo holds backend
delivery until its restore finishes
(`apps/backend-demos/src/routes/section/[sectionId]/+page.svelte:493-505`). The
default section strategy is a `localStorage` key per cohort
(`ToolkitCoordinator.ts:1063-1096`), so a nested section in the assessment player
can be restored twice: from that key during creation, then from the assessment
session.

A host whose engine selects one item at a time, as adaptive delivery does, holds
a single item config in the shape `<pie-item-player config>` takes, while the
section player takes an `AssessmentSection`. Each such host writes the wrapping
itself. The section demos write it by hand, with an invented `version`
(`apps/section-demos/src/lib/content/demo1-single-question.ts`).

## Goals

- A `session` property on the section player layout elements and on
  `<pie-assessment-player-default>`. Moving a host between item, section and
  assessment level then changes which content and session it binds; its restore
  wiring stays the same.
- A session supplied by property is applied inside controller creation, before
  the first composition, so no host guards a restore window.
- Assignment follows `<pie-item-player>`: every new value applies, an echo of the
  current session is a no-op, and an assignment cannot replace recorded
  responses with a response-free session.
- One PIE-owned function turns a single item config, and optionally its
  session, into the `section` and `session` those properties take.
- The assessment player restores each nested section through the section
  `session` property, retiring its post-`engine-ready` restore.

## Non-Goals

- Changing `applySession`, `hydrate`, `persist`, `configureSessionPersistence`
  or `updateItemSession`. Host A resumes through `applySession` after
  `toolkit-ready` and keeps doing so.
- Changing `SectionControllerSessionState` or `AssessmentSession`, or the
  item-id form in session maps and session events.
- An imperative helper that sets `section`, awaits the controller and applies a
  session. The property makes it unnecessary, and none was published.
- A session input on `pie-section-player-shell`, which loads no section, or on
  `pie-assessment-player-shell`, which has no controller.
- Moving the device-local `session-snapshot` to section level. It stays on
  `<pie-item-player>`, offered and never applied.
- Deciding whether the assessment session is the sole authority over embedded
  section state. That decision is open in the
  [lifecycle plan](../architecture/assessment-player-lifecycle-persistence-implementation-plan.md).
- Mapping `item-session-data-changed` to a host's own response payload.

## Package And Export Ownership

- Owning package for the section property: `@pie-players/pie-section-player`, on
  `pie-section-player-splitpane`, `pie-section-player-vertical`,
  `pie-section-player-tabbed` and `pie-section-player-kernel-host`.
  `pie-section-player-base` and `pie-assessment-toolkit` carry it to the
  coordinator as transport.
- Owning package for creation-time application:
  `@pie-players/pie-assessment-toolkit`, through an `initialSession` argument on
  `ToolkitCoordinator.getOrCreateSectionController`.
- Owning package for the assessment property: `@pie-players/pie-assessment-player`,
  on `pie-assessment-player-default`, and an `initialSession` field in the
  `AssessmentController` constructor's arguments.
- Owning package for `sectionFromItem`: `@pie-players/pie-section-player`. Public
  export path: a new `./item-section` subpath, built as its own
  side-effect-free entry like `policies`, listed node-safe in
  `scripts/publish-policy.json`, and re-exported from the package root.
- Types stay canonical in `@pie-players/pie-players-shared/types`:
  `AssessmentSection`, `ItemConfig`, `SectionControllerSessionState`,
  `AssessmentSession`. A referenced item, `AssessmentItemRef.item`, and its
  `passage` may omit `baseId` and `version`, and the passage its `name`
  (`ReferencedItemEntity`, `ReferencedPassageEntity`).
- Runtime environment: custom element for both properties; browser and Node for
  `sectionFromItem`.

## Contract Shape

### Section player `session`

```ts
// Documentation sketch only. Declared like `section`: { type: "Object", reflect: false }.
session: SectionControllerSessionState | null; // default null

// ToolkitCoordinator.getOrCreateSectionController arguments gain:
initialSession?: SectionControllerSessionState | null;
```

**Before publication.** The value travels with the controller request. For a new
controller, `initializeNewSectionController` configures the persistence strategy
and calls `initialize(input)` as today, then calls
`applySession(initialSession, { mode: "replace" })` in place of `hydrate()`. The
strategy still receives every `persist()`. When the coordinator already holds a
controller for the cohort, as a shared `runtime.coordinator` can, it calls
`updateInput` and then applies the value under the after-publication rules below.
The property takes precedence
over the strategy's stored snapshot because the host that supplies a session is
its authority, and the default strategy's key holds whatever a previous run of
the same cohort wrote.

The apply runs before `finalizeSectionControllerReady` publishes the controller
and emits its ready lifecycle event, so a `subscribeSectionLifecycleEvents`
subscriber, as Host A has, first sees the controller with the session applied.
That ordering puts the apply in the coordinator. The engine could apply after
`getOrCreateSectionController` resolves and leave the coordinator interface
alone, but by then the controller is published. Given an initial session, a
controller from `hooks.createSectionController` that lacks `applySession` fails
creation with a framework error rather than dropping the session.

The apply is part of creation, so disposal of an in-flight controller waits for
it, and a remount of the same cohort waits for that disposal, as a held `hydrate`
makes it wait today.

**After publication.** A new value is applied through
`applySession(value, { mode: "replace" })` under the two rules
`ItemController.setSession` applies
(`packages/players-shared/src/pie/item-controller.ts:79-98`):

- A value whose content equals the controller's current `getSession()` is a
  no-op, so a host that echoes `session-changed` into the property causes no
  apply.
- Per item, an assigned item session with neither a response value nor a
  response field (`hasResponseValue`, `hasResponseField` in
  `packages/players-shared/src/pie/item-session-contract.ts`) leaves an item
  session that holds responses in place. The embedded `<pie-item-player>`
  applies the same rule when the section hands the session down, so applying it
  at section level keeps the controller and its item players from diverging.

`null` after publication is a no-op. Clearing goes through reset or
`applySession`.

**Cohort change.** A `section` assignment that changes the cohort, without a
`session` assignment alongside it, creates the new controller through
`hydrate()` as today: a value applies only to the section it was assigned with.
Custom-element mount and the toolkit's section effect both run after the
synchronous code that assigns the properties, so `section` and `session`
assigned in either order in one turn behave as one assignment. The
implementation keeps that independent of binding order, and the test plan pins
it.

**Read.** Before publication the getter returns the assigned value. After it, the
getter returns `getSectionController().getSession()`, a fresh snapshot on each
read. `<pie-item-player>` returns the host's own object, kept current by
in-place projection for hosts migrating off `<pie-player>`. A deliberate
difference: no host reads a section session by reference, and a projection would
add a second write path into host state.

**Events.** A creation-time apply emits `section-session-applied`, as
`applySession` does, before `toolkit-ready`. No event payload, cardinality or
timing changes otherwise.

The property is an identity input like `section`, `section-id` and `attempt-id`,
and is not a `runtime` key. It is added to `SectionPlayerBasicPropName`
(`packages/section-player/src/contracts/layout-contract.ts`), to
`RECOMMENDED_BASIC_PROPS` and the per-layout contracts
(`packages/section-player/src/contracts/layout-parity-metadata.ts`), and to the
identity exceptions in `packages/section-player/ARCHITECTURE.md`.

### Assessment player `session`

```ts
// Documentation sketch only.
session: AssessmentSession | null; // default null

// AssessmentController constructor arguments gain:
initialSession?: AssessmentSession | null;
```

`session` joins `assessment`, `assessmentId`, `attemptId` and `hooks`, whose
change retires the controller and bootstraps a new one
(`AssessmentPlayerDefaultElement.ts:136-162`). The new controller runs
`onBeforeAssessmentHydrate`, takes `initialSession` where `hydrate()` would take
the strategy's `loadSession` result, and emits `assessment-session-applied`. A
value whose content equals the controller's current session is a no-op, which
keeps echoing safe. A different value rebuilds the controller and remounts the
current section. A deliberate trade: replacing a whole assessment session
mid-attempt is a resume, which remounts anyway, so the element needs no second
replace path into the controller.

The element passes the value to one controller: once a controller initializes
from it, a rebuild for another reason, such as an `assessment` change, hydrates
from the strategy, because the learner has since moved past that value. `null`
once the controller is ready is a no-op.

**Read.** Before the controller exists the getter returns the assigned value.
After it, the getter returns a copy of `controller.getSession()`, which hands out
the controller's internal object by reference
(`packages/assessment-player/src/controller/AssessmentController.ts:489-491`).

**Nested sections.** When the assessment session holds a section session,
`render()` sets it as `session` on the section element together with `section`,
and `attachSectionControllerReadyListener` stops calling `applySession` after
`engine-ready`. The section stays `inert` and `aria-busy` until `engine-ready`,
and accepts `session-changed` syncs only after it, as today. When the assessment
session holds none, the nested section is created through `hydrate()` as today.
A section that fails to become ready shows `player.assessment.restoreFailed` when
the element supplied a saved section session and `player.assessment.loadFailed`
otherwise. A section whose controller cannot be created, a failed creation-time
apply among them, never reaches `engine-ready` and reports a non-recoverable
`framework-error`; the element treats that error as the failure, ahead of its
readiness timeout.

### `sectionFromItem`

```ts
// Documentation sketch only. The ./item-section subpath of @pie-players/pie-section-player.
export interface ItemSectionOptions {
	/** Defaults to the item config's id. */
	sectionId?: string;
	itemVId?: string;
	/** The item's session, in the shape `<pie-item-player session>` takes. */
	session?: unknown;
}

export interface ItemSection {
	section: AssessmentSection;
	session: SectionControllerSessionState | null;
}

export function sectionFromItem(
	config: ItemConfig,
	options?: ItemSectionOptions,
): ItemSection;
```

- The section holds one `assessmentItemRef`. Its `identifier` and its item's `id`
  are the config's `id`, so the controller's canonical item id
  (`SectionController.getCanonicalItemId`) is the id the host already holds, and
  every `itemId` in section events is that id.
- A `PieContent` config becomes the item's `config`. For an `AdvancedItemConfig`,
  `pie` becomes the item's `config` and `passage` the item's `passage`, which the
  section player already renders
  (`packages/section-player/src/controllers/SectionContentService.ts:136-158`).
- `instructorResources` and `defaultExtraModels` stay embedded, copied onto the
  item's `config`, where `ConfigEntity` declares `defaultExtraModels` and accepts
  other keys; a value already on `pie` is kept. Neither player reads them:
  `<pie-item-player>` takes only `pie` and `passage` from an advanced config
  (`packages/item-player/src/PieItemPlayer.svelte:762-776`), and the section
  carries the rest as the item player does.
- The item and its passage carry no `baseId` or `version`. The helper has no
  source for either, and no player depends on them: preload signatures fall back
  to an empty version
  (`packages/section-player/src/components/shared/player-preload.ts:176-182`), and
  passage ids to a generated one (`SectionContentService.ts:49`).
- With `options.session` the returned session is
  `{ currentItemIndex: 0, itemSessions: { [config.id]: options.session } }`;
  without it, `null`.
- `section.identifier` is `options.sectionId ?? config.id`. No other identifier is
  created, and the inputs are not mutated.

A host assigns `section` and `session` from the result and sets `section-id` to
`section.identifier`.

## Compatibility

Hosts A and R depend on the section player's layout elements, coordinator and
controller methods, and Host A drives live delivery through them. The section
player's half of this contract is additive and inert while `session` is unset:

- Creation without an initial session runs `configureSessionPersistence`,
  `initialize`, `hydrate` and `finalizeSectionControllerReady` in that order,
  with the same lifecycle events and telemetry. `toolkit-ready` and
  `engine-ready` keep their timing.
- Host A's resume path is unchanged: `hydrate` after `toolkit-ready`,
  `getSession`, `applySession` in replace mode, `persist`, and the bare item-id
  form in session maps and events.
- Hosts set `runtime`, `section`, `hooks` and `toolRegistry` as object properties
  on the layout elements, and none sets `session`. The consumer pad's change-risk
  reference places additive layout props among the surfaces no host depends on.
- `initialSession` is optional on `ToolkitCoordinatorApi.getOrCreateSectionController`
  (`packages/assessment-toolkit/src/services/interfaces.ts:751`). A coordinator
  implementation that ignores it hydrates as today. Host R supplies a
  `ToolkitCoordinator` instance through `runtime.coordinator`, which lockstep
  versioning keeps current, and no recorded host implements the interface.
- Backend delivery: an item session's `id` becomes that item's
  `delivery.sessionId`
  (`packages/section-player/src/components/shared/section-player-backend-delivery.ts:247-265`).
  A creation-time session is applied before the first composition, so no item
  loads twice. A later assignment that changes an item session's `id` changes
  that item's delivery identity, and the item reloads
  (`packages/item-player/src/backend/delivery.ts:81-95`).
- Making `baseId` and `version` optional on a referenced item and its passage
  widens what a host may assign. Of the recorded hosts only Host R imports these
  types, and it assigns its own item type into `AssessmentItemRef.item` without
  reading either field back through them.
- Template surfaces: versioned tags, contract attributes and `pie-item-player`
  properties are untouched. Section-player session state and assessment-player
  state gain an input path with unchanged shapes. Persisted data is unchanged.

The section change records the consumer-pad rationale that
`bun run check:consumer-pad` requires.

The assessment player has no production consumer, and the pad records no host
importing it. Its `session` property, the controller rebuild on reassignment and
the move of its nested-section restore onto the section property are constrained
by in-repo demos and tests only.

## Data Ownership And Host Responsibilities

PIE owns:

- applying a supplied session at creation and on later assignment, under the
  precedence and response-protection rules above;
- the `session` getters;
- building a one-item section from an item config.

Hosts own:

- where a supplied session comes from and when it is stale;
- durable persistence, through a persistence strategy or their own save from
  session events;
- setting `section-id` to `section.identifier` when they use `sectionFromItem`.
  The layout kernel derives its readiness cohort from that attribute alone
  (`packages/section-player/src/components/shared/SectionPlayerLayoutKernel.svelte:608`);
- identity, authorization, retention and reporting.

## Serialization And Versioning

No persisted or wire-facing shape is added or changed. A supplied session is
validated as a loaded snapshot is today. `SectionController` normalizes item
session entries, raw `{ id, data }` or canonical, and canonicalizes their keys.
The assessment controller takes an `AssessmentSession` as loaded, without a
version check (`AssessmentController.ts:375-391`, `425-453`). This PRD adds no
validation.

## Accessibility

No runtime change for a host that does not set `session`. In the assessment
player a restored section no longer has a window in which it can render empty
before its restore, and it stays `inert` and `aria-busy` until `engine-ready`, as
today.

## Standards Or Adapter Impact

None. The properties carry existing PIE session shapes, and no adapter consumes
them.

## Test Plan

- Coordinator without `initialSession`: creation order, lifecycle events and
  telemetry match today's, for the default strategy and for a host-supplied
  coordinator through `runtime.coordinator`.
- Coordinator with `initialSession`: a new controller is configured, initialized
  and applied in replace mode, `hydrate` is not called, and `persist` writes to
  the strategy. A `subscribeSectionLifecycleEvents` subscriber reads the applied
  session at the ready event. An existing controller receives `updateInput`,
  then the apply. A hook-created controller without `applySession` fails
  creation.
- Layout elements, each of splitpane, vertical, tabbed and kernel-host:
  - `section` and `session` assigned in either order in one turn produce one
    creation-time apply and no `hydrate`;
  - a post-publication assignment applies, and an equal one does not;
  - a response-free item session does not replace one with responses;
  - a cohort change without a `session` assignment hydrates;
  - the getter returns the assigned value before publication and a current
    snapshot after it.

  `section-player-session-property.spec.ts` runs the creation-time cases on all
  four layouts and the rest on splitpane.
- Parity and mirror rules: `section-player-contract-parity.spec.ts` with
  `session` among the basic props of all three layouts; `m5-mirror-rule.test.ts`
  passes unchanged.
- Assessment controller: `initialSession` skips `loadSession`, runs
  `onBeforeAssessmentHydrate` and emits `assessment-session-applied`.
- Assessment element: a supplied `session` resumes without a `loadSession`, and
  an equal one is a no-op (`assessment-player-lifecycle.spec.ts`); a nested
  section receives its section session through `session`, and a held or failed
  creation-time apply keeps the section busy or shows `restoreFailed`
  (`assessment-answer-restoration.spec.ts`).
  `assessment-session-slice-round-trip` and `assessment-persistence-lab` pass
  unchanged.
- `sectionFromItem`: fixtures for `PieContent` with and without a session and
  for `AdvancedItemConfig` with a passage, instructor resources and default extra
  models; the result type-checks as an `AssessmentSection` without `baseId` or
  `version`; inputs are unchanged after the call; a
  round trip through a mounted section yields `item-session-data-changed`
  events whose `itemId` is the config id; the subpath imports in Node.
- Host A's resume path: the existing `hydrate` and `applySession` coverage passes
  unchanged.

Commands:

```sh
bun run typecheck
bun run test
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
bun run check:node-consumer-imports
bun run check:undeclared-subpaths
```

Playwright-backed tests run outside the sandbox.

## Rollout And Release Notes

- Changeset required: yes, patch under lockstep versioning.
- Migration notes: none required. A host that restores with
  `waitForSectionController` and `applySession` can bind `session` instead.
- Documentation updates:
  - `packages/section-player/README.md`: Session lifecycle, Usage, Item session
    management, Exports.
  - `docs/section-player/client-architecture-tutorial.md` §8, whose hydration
    sequence now runs persistence resolution and the apply before publication,
    as the code does.
  - `packages/assessment-player/README.md`: the reload list and Lifecycle.
  - `docs/assessment-player/client-architecture-tutorial.md` §4 props table, §10
    and §13.
  - `docs/item-player/overview.md`: cross-link from session management;
    `packages/item-player/README.md`: the `session` assignment rule.
  - `packages/section-player/ARCHITECTURE.md`: identity exceptions.
  - `docs/integrations/consumer-api-dependencies.md`, through its maintenance
    procedure.
- Release risk: low for the section player, where nothing changes without
  `session` and the new path with it is the creation-time apply inside the
  coordinator. None for recorded hosts from the assessment player.

## Open Questions

None.
