# Assessment Player Lifecycle And Persistence Decision Plan

Status: Deferred and unscheduled. Assessment-player changes remain a separate
workstream from generic item-player, section-player, and toolkit reliability
fixes. This document is not approval to start source changes.

Owner: PIE Players maintainers

Related:

- [Assessment player client architecture](../assessment-player/client-architecture-tutorial.md)
- [Assessment authoritative submission](../prds/assessment-authoritative-submission.md)
- [Consumer API dependencies](../integrations/consumer-api-dependencies.md)
- [Section player client architecture](../section-player/client-architecture-tutorial.md)
- [Framework-completing and product-completing work](./framework-completing-work.md)

## Why this work is separate

`pie-assessment-player-default` has no recorded external consumer today. That
makes this a good time to correct accidental public behavior, but it does not
validate a persistence, submission, or backend architecture. The assessment
player work must therefore be filed, implemented, reviewed, and released
separately from the confirmed generic fixes.

The immediate target is narrow: make the assessment custom element's documented
host lifecycle coherent with the item and section players. A host must be able to
connect the element, assign object properties afterward, and observe one truthful
readiness result without calling a private method.

## Reproduced problems

The following are current-code observations rather than proposed architecture:

- `connectedCallback()` starts work before the documented integration assigns
  `assessment`, `hooks`, `env`, and `coordinator`; most object properties are
  plain fields and later assignment does not trigger one coherent update.
- Repository demos compensate by calling the private `bootstrapController()`
  method.
- Repeated bootstrap calls have no generation or cancellation rule, so an older
  async result can publish after a newer request.
- `AssessmentController.initialize()` and `hydrate()` catch failures and resolve,
  allowing the element to report readiness after failed initialization.
- Both the controller and element invoke `onAssessmentControllerReady`, and
  controller getters can expose work before successful readiness.
- Disconnect detaches only part of the runtime. It does not invalidate pending
  work, dispose the controller, or distinguish an internally created coordinator
  from a host-owned one.
- Assessment persistence currently permits overlapping saves, reads mutable live
  state during asynchronous work, and can report submission before the final save
  succeeds. Demos contain compensating persistence behavior, including no-op
  section adapters and an additional LTI save queue.

The lifecycle and readiness failures are sufficient to plan a focused repair.
The persistence observations justify investigation, not a preselected design.

## Compatibility boundary

Refresh the consumer pad before implementation. If there is still no external
assessment-player consumer, correct the canonical API directly: do not add
aliases, duplicate events, deprecated properties, compatibility wrappers, or a
public bootstrap escape hatch.

Unless evidence from a real consumer requires a reviewed change, preserve:

- `pie-assessment-player-default` and `pie-assessment-player-shell` tag names;
- documented property and attribute names;
- assessment navigation, route, session, progress, error, and ready event names
  and their bubbling, composition, and cancellation behavior;
- versioned PIE tags and identifiers passed to nested players; and
- section-player and toolkit behavior documented for Quiz Engine and
  knowledge-check integrations.

Item-player compatibility is outside this workstream. Assessment changes must
not become a reason to alter its established host contracts.

## Decisions supported now

The assessment-player lifecycle repair may proceed once its consumer check and
host-shaped browser fixture are recorded. The public outcomes are:

- post-connect property assignment starts or updates the intended assessment;
- only the newest connected async attempt may publish a controller, UI, event,
  hook, or error;
- readiness means initialization and hydration succeeded;
- one successful attempt produces one ready event and one ready hook;
- failed, superseded, timed-out, or disconnected attempts do not expose a ready
  controller; and
- internally created controllers and coordinators are disposed by the element,
  while host-supplied coordinators remain borrowed.

The implementation may use accessors, a reconcile loop, generations, abort
signals, or another repository-native mechanism. This plan does not make those
internal techniques part of the public contract.

The generic `ToolkitCoordinator` disposal and same-cohort retirement fixes are a
separate prerequisite. They should land and be verified independently. The
assessment player may adopt the resulting canonical API; it must not duplicate
the coordinator algorithm or hide a remaining coordinator race.

## Decisions that need host evidence

Do not choose the following designs from repository demos alone:

- whether assessment-player, section-player, or a host is the durable owner of
  embedded section state;
- whether any new section-controller acquisition mode is needed;
- save ordering, coalescing, snapshot, retry, or failure-state semantics;
- assessment-session schema additions;
- authoritative-submission idempotency and receipt recovery; or
- backend retry, reload, and indeterminate-outcome behavior.

Before scheduling persistence work, use a representative host to document the
actual read and write boundaries, navigation and reload behavior, failure modes,
network contract, and which system is authoritative. Compare the smallest
options against that workload, including retaining the existing public seams.

Authoritative submission remains owned by the existing Draft
[Assessment Authoritative Submission PRD](../prds/assessment-authoritative-submission.md).
It is unscheduled pending representative host evidence and an accepted PRD. This
plan neither revises that contract nor selects its schema, queue, idempotency, or
recovery design.

## Required black-box evidence

Lifecycle work should be tested through public custom-element and controller
surfaces, not private method names or source-string assertions:

- Connect an empty element, assign the documented object properties, and prove
  one usable controller, one ready event, and one ready hook appear without a
  private call.
- Delay attempt A, replace its inputs with attempt B, complete A last, and prove
  only B can render or become ready.
- Reject delivery-plan creation and hydration independently; each failure must be
  observable, produce no ready signal, and leave controller getters truthful.
- Disconnect during initialization and prove no late DOM, event, hook,
  subscription, or controller publication occurs.
- Prove an element-created coordinator is disposed exactly once and a borrowed
  coordinator is not disposed by the element.
- Build and pack `@pie-players/pie-assessment-player`, then type-check a clean
  consumer using the documented public host contract.

If persistence or submission is later scheduled, add host-level evidence at the
real storage and HTTP boundaries. At minimum it must cover rapid updates,
navigation, reload, stale-write prevention, observable failures, and uncertain
network outcomes. The expected behavior comes from the accepted host contract
and PRD, not from this deferred plan.

## Decision gates

1. Refresh the consumer pad and record the representative host workflow.
2. Confirm the lifecycle repair does not require changes to documented section,
   Quiz Engine, knowledge-check, or item-player contracts.
3. Land the generic coordinator prerequisite separately with its own regression
   evidence.
4. Implement and review lifecycle/readiness as its own assessment-player change.
5. Schedule persistence only after the host ownership and network boundaries are
   explicit and an option has been selected from evidence.
6. Schedule authoritative submission only after its existing PRD is accepted.

Keeping these gates separate is intentional. A confirmed custom-element
lifecycle defect is not evidence for a new persistence mode, and a demo that is
self-consistent is not evidence that a backend recovery contract fits a real
host.
