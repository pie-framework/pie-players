# Framework-Completing And Product-Completing Work

Status: `Active` — scope discriminant. This note is cited by PRDs to justify
building or refusing a capability; it ratifies no contract of its own.

Tracking: not tracked in an issue tracker by design. This note's `Status:` line
is the record.

Related:

- [Formative delivery contract](../prds/formative-delivery-contract.md) — the
  worked example most of the classifications below draw on
- [Timed media section](timed-media-section.md) — where the port mechanism was
  first decided
- [P0 shared contracts](shared-contracts-p0.md) — the unbuilt contracts this
  note sorts
- [Consumer API dependencies](../integrations/consumer-api-dependencies.md) —
  who actually mounts what

## The discriminant

A capability is **framework-completing** when no host can supply it from outside
a PIE boundary, and **product-completing** when a host can. The distinction says
where an implementation would have to live; it does not, by itself, say that the
implementation should be built now. PIE implements framework-completing work
when a representative workload, an accepted external contract, or an explicitly
bounded experiment justifies it. PIE refuses product-completing implementations;
its obligation there is seam completeness, not implementation.

The test is mechanical: name the boundary the capability would have to live
inside. State PIE owns (Try state, the `env` projection, section session slices,
element rendering modes, custom-element contracts, event identity) can only be
extended from within. Everything a host already owns — taxonomies, workflow,
identity, storage, psychometrics, item selection — can be built on top of state
PIE exposes.

## Consumer evidence and priority

Consumer count does not decide ownership, but it is relevant evidence for
priority and contract confidence. A framework-completing gap can force several
hosts to invent incompatible workarounds, so waiting is not automatically free.
Conversely, a boundary that only PIE can implement does not prove that anyone
needs the capability, that its proposed shape fits a real host, or that its
runtime and maintenance cost is justified.

Before scheduling framework-completing work with no current consumer, name the
representative workload and establish at least one of these:

- a real downstream operation is blocked or is repeating a costly workaround;
- an accepted external or shared contract constrains the required behavior;
- the work is explicitly experimental, with a bounded validation period and an
  exit condition for promotion, revision, or deletion.

Repository demos and Playwright tests can prove browser behavior,
self-consistency, and regressions against the chosen contract. They do not prove
that lifecycle, package, network, persistence, or ownership choices fit a real
host. When those boundaries matter, use a representative host integration or
keep the result experimental until one exists.

## Classification

Framework-completing, unbuilt, in priority order:

| Capability | Boundary it must live inside | State |
| --- | --- | --- |
| External or asynchronous Try outcome | Try state machine and the `revealed` projection | `recordFormativeTry({ itemId, outcomes })` is synchronous with outcomes in hand; no Try can be recorded pending, and none can be revised. Autograders, code execution, human scoring, LLM feedback and peer aggregation all need it, and it is what turns `correctness: "unknown"` from a terminal state into a pending one |
| Hint reveal level | `FormativeFeedbackReveal` and the per-item `env` projection | The enum is `none \| correctness \| solution`; a fourth level is additive here plus an authored element-side field, and unreachable from a host |
| ~~Canonical `AssessmentSession` shape~~ | `players-shared/types`, where `AssessmentSection` already lives | **Done.** `SectionControllerSessionState` and the four assessment-session shapes are canonical in `players-shared/types`; `assessment-toolkit` and `assessment-player` re-export them. This replaced five byte-identical copies of a three-field `SectionSessionSnapshot` — one in `assessment-player`, one in each of four demo apps — that omitted the `formative` and `timedMedia` slices. Nothing was lost at runtime, since both `upsertSectionSession` implementations pass the snapshot through by reference; the cost was that the assessment layer could not read the slices it was already persisting without a cast. The toolkit is complementary to a player rather than an alternative to one and sits beneath both entry paths, which is why neither package owns the shape |
| Element formative-loop conformance | The element contract in `pie-elements-ng` | `docs/PIE_ELEMENT_CONTRACT.md` names the four modes and `outcome(model, session, env)`, and states nothing about what an element renders under `evaluate` × `student` versus `evaluate` × `instructor`, or that an `outcome()` without `score`/`max` drops the item out of every mastery denominator as `unknown` |
| Cross-section mastery rollup | `AssessmentSession` | Arithmetic over `FormativeSectionProjection`, inheriting two settled rules: `unknown` items leave the denominator, and `scorableItems === 0` is never vacuously complete. Unblocked: the canonical snapshot now carries the `formative` slice through the assessment session, with round-trip coverage in `packages/assessment-player/tests/assessment-session-slice-round-trip.test.ts` |
| Interaction event projection | Event identity and versioning | Instrumentation providers ship; the projection envelope — source reference, category, version — does not, and a host cannot synthesize stable identity from outside |
| Process and branching vocabulary | Section state machine | [Branching and process events](../prds/shared-contracts/branching-and-process-events.md), `Draft`, with Try state as its prerequisite and now shipped |

Product-completing, and out of scope: standards and skill alignment; policy
authoring surfaces; gradebooks, reporting and analytics warehouses; item banks
and media hosting; durable persistence; authorization and proctoring;
psychometrics; adaptive selection engines; peer- and staff-review workflow.

## Seam obligations

Refusing product-completing work is only defensible where the seam is complete.
Four shapes discharge that obligation, and each is already load-bearing:

**Per-item state addressable by canonical id.** `FormativeSectionProjection.states`
is `Record<string, FormativeItemState>` carrying `tryCount`, `firstCorrectTry`
and `lastOutcome`, so a host joins its own alignment table against it and
computes any rollup it wants. `FormativeMasteryRollup` stays flat for that
reason — a dimensioned rollup would embed one taxonomy in the framework.
`AssessmentItemRef extends SearchMetaDataEntity` carries the host's own metadata
alongside.

**Open model shapes.** `PieModel` carries an index signature, so an element
models whatever feedback, rationale or hint fields it needs without a
players-shared change. The element library is a starting set, not the surface.

**Authored policy as validated wire data, resolved per field.**
`resolveFormativePolicy` merges built-in defaults, section policy and item-ref
override with each field falling through independently on an unrecognized value,
so a CMS feeding policy costs one field on a typo rather than the section. No
authoring UI is owed; a documented schema and this resolution order are.

**Host-supplied outcomes.** `SectionController.recordFormativeTry` accepts
outcomes the host computed anywhere, including server-side, which is what keeps
the answer key out of the browser where a product needs it there. The shipped
control does not use that path — `SectionItemCard` requires `provideScore()` on
the item-player node and reports a failed check without it — so server-scored
Tries mean a host-rendered control driving the controller. Supported, and
undocumented.

## Ports

A port is the mechanism that converts a would-be framework dependency into a
host-supplied one. The [Media Time Source](timed-media-section.md#decisions-2026-08-15)
is the template: PIE orchestrates against a shape the browser already defines
(`currentTime`, `duration`, `paused`, `seekable`, `play()`, `pause()`, plus
time/seek/end notifications), the adapter declares its own capabilities
(`canPause`, `canRestrictSeeking`), and policy degrades from enforced to advisory
with a recoverable warning where a capability is absent. Silent degradation is
the failure mode the capability declaration exists to prevent.

Two consequences generalize. A host that already owns a media player, a code
execution sandbox or a grading service integrates without adopting a PIE
implementation of it — which is what makes those capabilities addable at all for
a platform that would otherwise refuse the dependency. And the PIE-supplied
implementation stays one adapter among several rather than the integration
surface.

## Adaptive selection

The engine is product-completing: item selection from an ability estimate needs
IRT parameters, exposure control and a selection service, none of which PIE
should hold. The framework obligation is that an external engine can drive
selection, and coarse adaptivity already works through remount-and-hydrate.

`SectionController.normalizeApplySession` filters an applied snapshot against the
**current** section's item refs: item sessions and `visitedItemIdentifiers` are
dropped for identifiers the new section does not contain, the formative slice is
normalized against the same allowed set, a `timedMedia` slice is normalized
against the new section's cue data, and `currentItemIndex` is clamped to the new
item count. So a host that snapshots, sets a revised section, and re-hydrates
keeps state for retained items — including `revealed`, so a learner returns to
the screen they left — and discards state for items that are gone.

What that costs: a full section mount per adaptive step, losing focus, scroll and
any element-local state not in the session, and the host must snapshot before
replacing the section. In-place branching without a remount is what
[branching and process events](../prds/shared-contracts/branching-and-process-events.md)
is for; it is a latency and continuity improvement over a mechanism that already
works, not the thing that makes adaptivity possible.

Unverified: whether setting a new section input on a live element rebuilds
cleanly. Remount-and-hydrate is the supported path.
