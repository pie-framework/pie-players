# Formative Delivery Contract

Status: Accepted, 2026-08-15

Owner: PIE Players maintainers

Tracking: not tracked in an issue tracker by design. This PRD's `Status:` line is
the record.

Related architecture:

- [Formative delivery before timed media](../adr/0001-formative-delivery-before-timed-media.md) — the sequencing decision this PRD implements
- [Timed media section](../architecture/timed-media-section.md) — the first downstream consumer of Try state
- [P0 shared contracts](../architecture/shared-contracts-p0.md)
- [Score components and section outcomes](./shared-contracts/score-components-and-section-outcomes.md) — the wider projection this PRD partially satisfies
- [Timed media section contract](./timed-media-section-contract.md) — cue gate conditions compose with the state defined here

## Problem

PIE can score an item in the browser and cannot deliver a formative item. The
scoring half already ships: `scorePieItem(...)` in
`packages/players-shared/src/pie/scoring.ts` calls each element controller's
`outcome(model, session, env)` under `mode: "evaluate"`, and
`pie-item-player.provideScore()` exposes that imperatively. What is missing is
the delivery state around it — how many times a learner may submit one item, when
its feedback becomes visible, and how a section reports how much was mastered.

The three gaps are all at the section layer:

- **No Try state.** `TestAttemptItemSession` carries `attemptCount`, but that
  counts distinct `pieSessionId` values — a session-realization counter that
  increments when the underlying PIE session is replaced. Nothing records that a
  learner submitted an answer for checking, or what came back.
- **No per-item mode.** `PieSectionPlayerBaseElement` derives one section-wide
  `env` and hands the same object to every card. Revealing feedback on one item
  while its neighbours stay editable has no seam.
- **No mastery rollup.** `SectionController` rolls up completion and stops there,
  which is correct — completion is not correctness — and leaves correctness
  unrolled.

Without this contract every host that wants check-answer delivery reimplements
try counting, feedback gating, and rollup against internal session shapes.

## Goals

- Define **Try** as PIE's unit of one submitted-for-checking pass over an item,
  distinct from the assessment-level attempt PIE already names.
- Define authored formative policy on the section and per item ref, with
  item-over-section resolution.
- Define **Feedback Reveal** as a projection onto the item's `env`, so element
  feedback rendering stays element-owned.
- Define **Mastery** as a section rollup that keeps not-auto-scorable items out
  of the denominator instead of scoring them zero.
- Make the state persisted, versioned, and hydratable through the existing
  section session snapshot.
- Leave a state surface that a timed-media cue can gate on without extension.

## Non-Goals

- No branching or adaptive item selection. Making the next thing shown depend on
  correctness is [`branching-and-process-events`](./shared-contracts/branching-and-process-events.md)
  ground; Try state is its prerequisite and is deliberately shipped first and
  alone.
- No new evaluation machinery. `provideScore()` and `scorePieItem(...)` are
  consumed unchanged; neither is replaced, wrapped, or re-implemented.
- No server-authoritative scoring, durable persistence, gradebook, or reporting.
- No manual scoring, rubric review, or scorer identity.
- No assessment-level mastery across sections. `assessment-player` is untouched.
- No per-element Try state. A Try is item-scoped even when an item holds several
  interactions.
- No feedback UI. PIE selects the render mode; what an element draws in that mode
  is the element's contract.
- No timed-media cue gating. This PRD is the substrate that one is built on.
- No QTI conformance claim, and no adapter. The vocabulary is mapped to QTI 3
  below so `pie-qti` can consume it losslessly; that is not the same as
  conforming.

## Package And Export Ownership

- Owning package: `@pie-players/pie-players-shared` (source at
  `packages/players-shared/src/formative`).
- Public export path: `@pie-players/pie-players-shared/formative` for policy
  resolution, outcome aggregation, the Try-state reducer, the item view, and the
  mastery rollup. Authored policy fields reach `AssessmentSection` and
  `AssessmentItemRef` through `@pie-players/pie-players-shared/types`, which is
  where those interfaces already live.
- Runtime home: `SectionController` in `@pie-players/pie-section-player` owns the
  live state, because it already owns the equivalent aggregate — per-item
  completion keyed by canonical id, rolled up and emitted on change. Formative
  state is the same shape with a different predicate, and splitting it from
  completion would put two rollups over one item set in two packages.
  `@pie-players/pie-assessment-toolkit` owns only the contract interface and the
  event route, matching how it already treats item sessions.
- Consuming packages or apps: `section-player`, `assessment-toolkit`,
  `apps/section-demos`, future timed-media layouts, `pie-qti` adapters.
- Runtime environment: the `formative` module is pure and Node-safe — no DOM, no
  timers, no element registry. Everything that touches the DOM stays in
  `section-player`.

The pure module is what makes the contract testable without a browser and what a
QTI adapter can import without pulling in a player.

## Contract Shape

### Authored policy

```ts
export type FormativeTryLimit = number | "unlimited";
export type FormativeFeedbackReveal = "none" | "correctness" | "solution";
export type FormativeRevealTiming = "on-try" | "on-final-try";

export interface FormativeDeliveryPolicy {
  /** Absent or `false` leaves delivery exactly as it is today. */
  enabled?: boolean;
  /** Default 1. `"unlimited"` for practice. */
  maxTries?: FormativeTryLimit;
  /** Default `"correctness"`. */
  feedback?: FormativeFeedbackReveal;
  /** Default `"on-try"`. */
  revealOn?: FormativeRevealTiming;
}

export type FormativeItemPolicy = FormativeDeliveryPolicy;

export interface ResolvedFormativePolicy {
  enabled: boolean;
  maxTries: FormativeTryLimit;
  feedback: FormativeFeedbackReveal;
  revealOn: FormativeRevealTiming;
}
```

`AssessmentSection.formative` sets the section default;
`AssessmentItemRef.formative` overrides it field by field. Resolution order is
built-in default → section → item ref, which is the order QTI 3 uses for
`qti-item-session-control` on `qti-assessment-section` and
`qti-assessment-item-ref`.

`revealOn: "on-final-try"` withholds feedback until the tries are spent. It has
no meaning under `maxTries: "unlimited"` — there is no final try — and resolves
to `"on-try"` there.

### Try state

```ts
export type FormativeCorrectness = "correct" | "partial" | "incorrect" | "unknown";

export interface FormativeTryOutcome {
  correctness: FormativeCorrectness;
  points?: number;
  max?: number;
  scoredElementCount: number;
  totalElementCount: number;
  /** The per-element outcomes the aggregate came from. */
  elementOutcomes?: FormativeScoredOutcome[];
}

export interface FormativeItemState {
  version: 1;
  itemIdentifier: string;
  tryCount: number;
  revealed: boolean;
  lastOutcome?: FormativeTryOutcome;
  /** The 1-based Try on which the item first scored full credit. */
  firstCorrectTry?: number;
  /** Reveal level a host forced, overriding the policy's for the env projection. */
  revealOverride?: FormativeFeedbackReveal;
}

export interface FormativeSectionSlice {
  version: 1;
  items: Record<string, FormativeItemState>;
}
```

`revealed` is live delivery state, not a fact about the response: it is what
distinguishes "checked, feedback on screen, editing locked" from "editable
again after a retry". It persists so a reload restores the screen the learner
left.

### Correctness derivation

`aggregateFormativeOutcome(outcomes)` reduces the array `provideScore()` returns
to one `FormativeTryOutcome`, following the aggregation the persisted API path
already documents in [`../item-player/scoring-and-rubrics.md`](../item-player/scoring-and-rubrics.md):

- one scored outcome: `points = score`, `max = max ?? 1`;
- several: `points = sum(score / (max ?? 1)) / count`, `max = 1`;
- no scored outcome: `correctness: "unknown"`, no points.

`correctness` is `"correct"` at full credit, `"incorrect"` at zero, `"partial"`
between, `"unknown"` when nothing scored. An item holding a rubric element, or
any element whose controller has no `outcome`, lands on `"unknown"` — the same
condition the API path reports as "no manual score available".

`elementOutcomes` retains the per-element outcomes verbatim, for a host rendering
its own feedback rather than the element's evaluate-mode rendering. Empty slots
are dropped — every real entry identifies its own model, and a `null` hole in a
persisted array carries nothing a host could use — while `totalElementCount`
still counts them. A trade: these persist inside the session slice, so a snapshot
grows by whatever the elements put in their outcomes, and some include a scoring
trace. Validation stops at "an array of objects", because reaching further would
make this contract decide what an element's outcome may contain.

### Feedback Reveal as an env projection

```ts
export interface FormativeEnvOverride {
  mode: "evaluate";
  role: "student" | "instructor";
}
```

While an item is `revealed`, the section projects this over the section env for
that item alone:

| `feedback` | projection | effect |
| --- | --- | --- |
| `"none"` | none | the Try is recorded, nothing is revealed |
| `"correctness"` | `mode: "evaluate"`, `role: "student"` | the element renders its own correctness feedback |
| `"solution"` | `mode: "evaluate"`, `role: "instructor"` | the element additionally renders the authored correct response |

PIE guarantees the mode and role it projects, not what a given element draws in
them. `env.role` has never been an authorization boundary — it selects a
rendering. The host decides whether a learner may see solutions by setting the
policy; PIE enforces that decision by not projecting `"instructor"` otherwise.

`mode: "evaluate"` also makes elements read-only, which is the behavior a
revealed item wants. A retry clears `revealed`, the projection is withdrawn, and
the item is editable again at the section's own mode.

### Item view

`resolveFormativeItemView(policy, state)` derives what a card needs, so no
component reimplements the predicate:

```ts
export interface FormativeItemView {
  enabled: boolean;
  tryCount: number;
  triesRemaining: number | "unlimited";
  canCheck: boolean;
  canRetry: boolean;
  revealed: boolean;
  envOverride?: FormativeEnvOverride;
  lastOutcome?: FormativeTryOutcome;
}
```

The view carries no copy. Wording and announcements belong to the rendering
package, alongside the other card strings.

### Mastery rollup

```ts
export interface FormativeMasteryRollup {
  version: 1;
  totalItems: number;
  /** Items with a derivable outcome. `"unknown"` items are excluded. */
  scorableItems: number;
  masteredItems: number;
  triedItems: number;
  /** Mean Try on which mastered items first scored full credit. */
  averageTriesToMastery?: number;
  complete: boolean;
}
```

`complete` is `masteredItems === scorableItems && scorableItems > 0`. An item
that cannot be auto-scored is excluded from the denominator rather than counted
wrong, which keeps this rollup from asserting correctness it cannot know.
`scorableItems === 0` yields `complete: false`, never vacuous mastery.

### Controller surface

`SectionController` gains three methods, all optional on
`SectionControllerHandle` in keeping with the rest of that interface:

```ts
recordFormativeTry?(args: { itemId: string; outcomes?: unknown[] }): void;
retryFormativeItem?(args: { itemId: string }): void;
revealFormativeItem?(args: {
  itemId: string;
  feedback: "correctness" | "solution";
}): void;
hideFormativeItem?(args: { itemId: string }): void;
getFormativeProjection?(): FormativeSectionProjection | null;
```

`revealFormativeItem` / `hideFormativeItem` are host authority — a teacher-driven
"show the answer". They spend no Try and ignore the Try budget and `revealOn`,
because none of those bound a decision the host has already taken, and they work
on an item with no Try yet. `retryFormativeItem` is the learner action and stays
budget-respecting: an item with no Tries left keeps its feedback on screen.

`feedback` is stated rather than defaulted from the policy, because a reveal
under `feedback: "none"` would project nothing. It is recorded as
`FormativeItemState.revealOverride` and governs the env projection until it is
withdrawn — including by a learner retry, so a forced solution does not silently
upgrade every later reveal on that item.

No new element surface. `getSectionController()` / `waitForSectionController()`
on every layout already return this handle, which is where `getSession`,
`applySession` and `updateItemSession` already live; forwarding four more methods
through layout → kernel → scaffold → base would be passthrough for nothing.

```ts
export interface FormativeSectionProjection {
  version: 1;
  enabled: boolean;
  policies: Record<string, ResolvedFormativePolicy>;
  states: Record<string, FormativeItemState>;
  mastery: FormativeMasteryRollup;
}
```

The projection joins `SectionCompositionModel`, so it reaches layouts through
the `composition-changed` republish the runtime already performs on every
controller event. No new host-facing event channel is added.

One thing that republish needed: the toolkit coalesces composition emits behind a
revision key over section id, current item, renderables and item sessions.
Recording a Try changes none of those, so formative state joins that key.
Without it the controller holds correct state and the card never learns its
feedback was revealed — the failure is invisible to every unit test, which is why
the browser coverage below is not optional.

Three controller events join the existing union:

```ts
{ type: "formative-try-recorded", itemId, canonicalItemId, tryCount, outcome, revealed, currentItemIndex, timestamp }
{ type: "formative-reveal-changed", itemId, canonicalItemId, revealed, feedback?, tryCount, source: "learner" | "host", currentItemIndex, timestamp }
{ type: "section-mastery-changed", mastery, currentItemIndex, timestamp }
```

`formative-reveal-changed` covers every reveal transition a Try did not cause — a
learner retry, a host reveal, a host withdrawal — with `source` naming which. A
Try that reveals reports through `formative-try-recorded`, which carries its own
`revealed`.

`section-mastery-changed` emits on rollup change, matching how
`section-items-complete-changed` emits on completion change. A forced reveal never
emits it: showing an answer is not answering.

### Learner action route

The card owns the control and the item player node, so it is the only place that
can call `provideScore()`. It reports the result rather than interpreting it:

```
card → pie-formative-action (cross-boundary DOM event)
     → PieAssessmentToolkit listener
     → SectionRuntimeEngine
     → SectionController.recordFormativeTry / retryFormativeItem
     → controller change event → composition republish → card re-renders
```

`{ itemId, canonicalItemId?, action: "check" | "retry", outcomes?: unknown[] }`.
This is the route `pie-item-session-changed` and `pie-content-loaded` already
take; nothing new is invented for it.

## Compatibility

Additive throughout. A section without `formative` renders exactly as it does
today: the resolved policy is disabled, no projection is produced, no control is
rendered, and no env override is applied.

This PRD does not change:

- PIE element runtime or controller contracts;
- versioned `pie-*--version-*` tag names or any contract identifier;
- `pie-item-player` properties, events, or imperative methods —
  `provideScore()` is called, not modified, and keeps its
  `pie-item contract compatibility` exemption unchanged;
- existing section item-session propagation or completion behavior;
- `assessment-player` routing, submission, or rollup.

Existing persisted `SectionControllerSessionState` snapshots stay valid: the
`formative` slice is optional and its absence is indistinguishable from a
pre-formative save.

No compatibility shim is added. A `formative` slice with an unrecognized
`version` is rejected rather than normalized.

Every type member this adds is optional, `SectionCompositionModel.formative` and
the four `SectionControllerHandle` methods included, so anything else assembling a
composition model or supplying a controller — a host layout, an adapter, a test
double — omits what it does not use and absent reads as `null`. The one addition
no default covers is the widened `SectionControllerEvent` union: a host switching
exhaustively over `event.type` with no `default` gains three unhandled variants,
the ordinary cost of a producer adding events.

## Data Ownership And Host Responsibilities

PIE owns:

- the Try, Feedback Reveal, and Mastery vocabulary and its resolution order;
- correctness derivation from element outcomes, including the not-scorable case;
- the per-item env projection and its withdrawal on retry;
- the section-scoped state machine, its events, and its session slice;
- the control's rendering, keyboard behavior, and announcements.

Hosts own:

- whether formative delivery is enabled, and the policy values;
- durable persistence of the session snapshot;
- authorization — including whether a learner is permitted solutions;
- reporting, gradebooks, and any mapping of mastery into product records;
- authoring of the policy, which no PIE package supplies a UI for.

## Serialization And Versioning

`FormativeItemState` and `FormativeSectionSlice` are persisted through
`SectionControllerSessionState.formative`.

- Version field: `version: 1` on both the slice and each item state.
- Validation owner: the `formative` module in `players-shared`;
  `SectionController` calls it and never hand-parses.
- Unknown fields: dropped.
- Unknown item identifiers: dropped, matching how `normalizeApplySession`
  filters `itemSessions` against the section's canonical ids.
- Unknown version: the slice is rejected whole and delivery starts from a clean
  formative state. Item sessions in the same snapshot are unaffected — a
  formative version bump must not cost a learner their responses.
- Migration: none needed at version 1.

Round-trip fixtures cover: zero tries; one try with each of the four
correctness values; tries exhausted; revealed and then retried; `"unlimited"`
tries; a section mixing scorable and not-scorable items; and an unknown-version
slice beside valid item sessions.

## Accessibility

The control is the only new user-facing surface, and it must satisfy WCAG 2.2 AA:

- native `<button>`, in tab order, labelled with its action rather than the item;
- the outcome is announced through a polite live region that is present in the
  DOM before it has content, so the announcement is not lost (4.1.3);
- focus stays on the control across a check. Feedback appears above it and
  moving focus there would steal it mid-task; the live region carries the
  result instead. The control is therefore never disabled while a check is in
  flight: disabling the focused element moves focus to the document body, so a
  keyboard learner who pressed Enter had to tab back to a control whose label had
  changed under them. `aria-busy` states the same thing without leaving the
  accessibility tree, and re-entry is dropped by the handler and by the reducer;
- correctness is never colour alone — the announcement and the visible status
  both carry text (1.4.1);
- when tries are spent the control is removed rather than disabled, so no
  focusable element is left without an accessible explanation;
- the control is at least 24×24 CSS pixels (2.5.8) and paints only from `--pie-*`
  tokens, so it follows every base theme and colour scheme;
- reveal changes the item to read-only through `mode: "evaluate"`. That is an
  element-owned rendering, and an element that leaves inputs enabled in evaluate
  mode is an element defect, not something the section compensates for.

## Standards Or Adapter Impact

The vocabulary is deliberately mappable onto QTI 3 so `pie-qti` inherits it
rather than reinterpreting it:

| PIE | QTI 3 |
| --- | --- |
| `formative.maxTries` | `qti-item-session-control@max-attempts` (`"unlimited"` ↔ `0`) |
| `formative.feedback !== "none"` | `qti-item-session-control@show-feedback` |
| `formative.feedback === "solution"` | `qti-item-session-control@show-solution` |
| `FormativeItemState.tryCount` | item session `numAttempts` |
| `FormativeTryOutcome.correctness` | derived from `SCORE` / `MAX_SCORE`, not a QTI variable |

PIE keeps its own names because `attempt` is already taken at two levels in this
codebase — `TestAttemptSession` for the administration and
`TestAttemptItemSession.attemptCount` for session realization — and a third
`attempt` at the item level would be read as one of those. **Try** is
unambiguous and maps cleanly.

QTI's `allow-comment`, `allow-skipping`, and `validate-responses` are not
represented. There is no candidate-comment surface, no skip gate, and no
response-validation step to honour them with, and declaring fields PIE ignores
is worse than omitting them.

No conformance is claimed. The mapping table is for the adapter's benefit; the
adapter and its validation suite do not exist.

## Test Plan

- Policy resolution: defaults, section-only, item override per field, the
  `"on-final-try"` + `"unlimited"` coercion.
- Outcome aggregation: single scored, multiple scored averaging, partial credit,
  zero credit, no controller, mixed scored and unscored, `max` absent.
- Try-state reducer: first try, subsequent tries, exhaustion, retry clearing
  `revealed`, `firstCorrectTry` recorded once and not overwritten by a later
  incorrect try, `feedback: "none"` never revealing, `"on-final-try"` revealing
  only on the last try.
- Item view: `canCheck` / `canRetry` / `envOverride` across the state space.
- Mastery rollup: all mastered, none, partial, not-scorable excluded from the
  denominator, `scorableItems === 0` not complete, `averageTriesToMastery`.
- Session slice: round-trip fixtures above, unknown-id filtering,
  unknown-version rejection leaving item sessions intact.
- `SectionController`: try recorded and event emitted, mastery event on change
  only, projection present in the composition model, disabled sections producing
  no projection.
- View state: per-item env override applied to the revealed item only, section
  env unchanged for its neighbours, override withdrawn on retry.
- Browser, against a real item player and the internal event route: the control
  renders only where the policy is enabled; a check reveals correctness on that
  item alone while its neighbours stay at the section env; a retry reopens it; a
  single-try item loses its control; `feedback: "solution"` projects the
  instructor role; `on-final-try` records a Try and reveals nothing until the
  last; the status region is polite and present before it has content; the
  control is operable by keyboard and keeps focus across a check; the mastery
  rollup reflects the Tries taken.

Commands:

```sh
bun run typecheck
bun run test
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
bun run check:capability-neutrality
bun run check:player-tool-boundaries
```

Playwright-backed coverage runs outside the sandbox.

## Rollout And Release Record

Accepted on 2026-08-15. The change was additive and gated behind
`formative.enabled`; existing content remained unaffected. The implementation
included the required package changeset, public documentation, demo coverage,
and persisted-session coverage.

## Resolved Decisions

- **Try, not attempt.** See the QTI mapping above for why.
- **Section env stays section-wide; the override is per item.** The alternative
  — a per-item env in the runtime config — would make every layout carry an
  env-resolution order. The override is derived from formative state at the one
  point item params are built.
- **Correctness is derived, never authored.** No `correctResponse` field is
  added anywhere. Correctness comes from element controllers, which already own
  it.
- **Mastery excludes what it cannot score.** Counting a rubric item as incorrect
  would report a false negative to a gradebook.
- **The control lives in the item card, not in a capability.** A capability
  cannot reach `provideScore()` on the item player without a new bridge, and
  formative delivery is delivery semantics rather than an accommodation or tool.

## Sequenced Next

**Mastery reaches `assessment-player` as a cross-section rollup**, and it does
not wait for [`score-components-and-section-outcomes`](./shared-contracts/score-components-and-section-outcomes.md).
Summing section rollups needs no score authority, no provenance and no manual
state, which are that PRD's hard open questions; blocking on them would trade a
week of arithmetic for a Draft.

The real prerequisite is smaller and sharper: `AssessmentSession` exists in both
`assessment-toolkit` and `assessment-player`, and
[`shared-contracts-p0`](../architecture/shared-contracts-p0.md) already records
that the canonical type home must be chosen before assessment-level fields are
added. Adding a mastery rollup to the wrong one means migrating it later.
`assessment-player` also has no data-driven renderer selection and no consumer,
so a cross-section rollup lands there with no host to validate it against — worth
knowing before scheduling it, not a reason to defer.

Two things this contract already settled that the assessment rollup must not
re-decide: `unknown` items leave the denominator rather than scoring zero, and
`scorableItems === 0` is never vacuously complete. A cross-section rollup that
sums `masteredItems` and `scorableItems` inherits both.

## Open Questions

None outstanding.
