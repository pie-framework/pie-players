# Assessment Player Lifecycle And Persistence Decision Plan

Status: Active — technical scope and decision gates for the assessment repairs
in the [delivery remediation plan](./delivery-reliability-remediation-plan.md).
That plan owns priority, branches, issue status, and completion evidence.
Authoritative submission remains a separate workstream.

Owner: PIE Players maintainers

Related:

- [Delivery reliability and accessibility remediation plan](./delivery-reliability-remediation-plan.md)
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

The lifecycle and readiness failures support the focused R3 repair. R2 tracks
persistence investigation and a bounded repair; the observations do not select
its internal design or justify a new storage or submission architecture.

## Compatibility boundary

Refresh the consumer pad before downstream sign-off. The local lifecycle repair
can be prepared against the documented public host contract while requested
consumer checkouts are unavailable, but stays in draft with that verification
explicitly pending. Do not advance existing verification dates from a local
fixture. If there is still no external assessment-player consumer, correct the
canonical API directly: do not add
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

The assessment-player lifecycle repair uses a host-shaped browser fixture and
records the consumer check separately before leaving draft. The public outcomes are:

- post-connect property assignment starts or updates the intended assessment;
- only the newest connected async attempt may publish a controller, UI, event,
  hook, or error;
- readiness means initialization and hydration succeeded;
- one successful attempt produces one ready event and one ready hook;
- failed, superseded, timed-out, or disconnected attempts do not expose a ready
  controller; and
- the element disposes its assessment controller and removes its nested player;
  the nested toolkit retains ownership of its internally created coordinator
  and disposes it through the existing API, while host-supplied coordinators
  remain borrowed.

The implementation may use accessors, a reconcile loop, generations, abort
signals, or another repository-native mechanism. This plan does not make those
internal techniques part of the public contract.

The generic `ToolkitCoordinator` disposal and same-cohort retirement prerequisite
landed in `e3169f8b`. Verify its existing regression coverage when adopting the
canonical API; the assessment player must not duplicate the coordinator algorithm
or hide a remaining coordinator race.

## Decisions that need host evidence

Do not choose the following designs from repository demos alone:

- whether assessment-player, section-player, or a host is the durable owner of
  embedded section state;
- whether any new section-controller acquisition mode is needed;
- save ordering, coalescing, snapshot, retry, or failure-state semantics;
- assessment-session schema additions;
- authoritative-submission idempotency and receipt recovery; or
- backend retry, reload, and indeterminate-outcome behavior.

R2 begins with a representative host's actual read and write boundaries,
navigation and reload behavior, failure modes, network contract, and authority.
Before choosing and implementing persistence behavior, compare the smallest
options against that workload, including retaining the existing public seams.
Assigning the issue a branch does not satisfy this evidence gate.

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
- Prove a nested toolkit's owned coordinator is disposed exactly once and a borrowed
  coordinator is not disposed by the element.
- Build and pack `@pie-players/pie-assessment-player`, then type-check a clean
  consumer using the documented public host contract.

R2 requires host-level evidence at the real storage and, where applicable, HTTP
boundaries. At minimum it must cover rapid updates, navigation, reload,
stale-write prevention, observable failures, and uncertain network outcomes.
The expected behavior comes from the recorded host contract. Authoritative
submission requires its own accepted PRD before implementation.

## Decision gates

1. Record the public host fixture and refresh the consumer pad before downstream
   sign-off. Missing checkouts keep the repair in draft; they do not turn local
   fixture evidence into downstream verification.
2. Confirm the lifecycle repair does not require changes to documented section,
   Quiz Engine, knowledge-check, or item-player contracts.
3. Verify the already-landed generic coordinator prerequisite with its regression
   evidence.
4. Implement and review lifecycle/readiness as its own assessment-player change.
5. Implement the planned persistence repair only after host ownership and network
   boundaries are explicit and an option has been selected from evidence.
6. Schedule authoritative submission only after its existing PRD is accepted.

Keeping these gates separate is intentional. A confirmed custom-element
lifecycle defect is not evidence for a new persistence mode, and a demo that is
self-consistent is not evidence that a backend recovery contract fits a real
host.
