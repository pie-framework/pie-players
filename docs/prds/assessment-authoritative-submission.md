# Assessment Authoritative Submission

Status: Draft, 2026-08-26

Not scheduled: its priority follows the reference assessment player's
([framework-completing work](../architecture/framework-completing-work.md#decisions-that-need-host-evidence)).

Owner: `@pie-players/pie-assessment-player`

Scope: the reference assessment player only
([product scope](../architecture/architecture.md#product-scope)). Production
assessment players are host-built and submit through their own backend, so this
contract binds no building block. A part a custom player would also need, such
as the failure vocabulary, belongs in a building block if it is ever built.

Related architecture:

- [Backend support](../item-player/backend-support.md)
- [Building a multi-section player](../assessment-player/integration-guide.md)
- [Framework-completing and product-completing work](../architecture/framework-completing-work.md)
- [Consumer API dependencies](../integrations/consumer-api-dependencies.md)

## Problem

`AssessmentController.submit()` saves the final `AssessmentSession` through
`AssessmentSessionPersistenceStrategy`, and only after that save succeeds marks
the controller submitted and emits `assessment-submission-state-changed`. Saves
run one at a time in call order, so an older write never lands after a newer
one. A failed save reaches `hooks.onError` with phase `session-save` and fails
only its own caller: `submit()` then rejects, and `persist()` resolves. That is
enough for local lifecycle state, but it cannot represent a backend that must
finalize an attempt exactly once, reject a conflict, return an authoritative
receipt, or recover after an indeterminate request.

Ordinary snapshot persistence and terminal submission are different operations.
Overloading `saveSession()` with both meanings makes idempotency and failure
behavior implicit, while adding `backend.assessment` would duplicate the existing
assessment hook and controller interfaces. PIE needs one explicit terminal
operation at the assessment-controller seam.

## Goals

- Add a host-supplied authoritative submission strategy without adding a parallel
  backend namespace.
- Give every logical submission a stable idempotency key across retries.
- Return a typed receipt that host chrome can observe without prescribing a
  backend wire protocol.
- Keep the assessment editable when authoritative submission fails.
- Make concurrent calls deterministic and prevent duplicate finalization.
- Preserve the existing session-persistence strategy for hydrate, autosave, and
  ordinary progress saves.

## Non-Goals

- No built-in REST, GraphQL, LTI, QTI, xAPI, or Caliper client.
- No assessment or section definition loading. A host fetches definitions before
  assigning player inputs; a definition-source interface is added only if
  player-owned loading removes repeated host orchestration, and never for
  symmetry with item delivery.
- No gradebook, reporting, authorization, proctoring, or workflow implementation.
- No server conflict-resolution policy; PIE reports typed outcomes and leaves the
  decision to the host adapter.
- No `backend.assessment` alias and no changes to item `backend.delivery`.
- No section-level submission strategy in this slice.
- No persisted migration of existing `AssessmentSession` fields unless a later
  review proves the idempotency key must survive page reload.

## Package And Export Ownership

- Owning package: `@pie-players/pie-assessment-player`.
- Public export path: `@pie-players/pie-assessment-player` through the existing
  assessment-player entrypoint.
- Consuming packages or apps: the assessment demos and LTI demo; section-player
  and item-player do not consume this contract.
- Runtime environment: browser custom-element/controller interface with a
  host-supplied adapter.

The canonical types live beside `AssessmentPlayerHooks`,
`AssessmentSessionPersistenceStrategy`, and `AssessmentControllerHandle`. No
consumer redefines them.

## Contract Shape

```ts
// Documentation sketch only.
export interface AssessmentSubmissionContext
  extends AssessmentSessionPersistenceContext {
  idempotencyKey: string;
}

export interface AssessmentSubmissionReceipt {
  id: string;
  submittedAt?: string;
  metadata?: Record<string, unknown>;
}

export type AssessmentSubmissionFailureKind =
  | "conflict"
  | "rejected"
  | "retryable"
  | "unknown";

export class AssessmentSubmissionError extends Error {
  readonly kind: AssessmentSubmissionFailureKind;
  readonly retryAfterMs?: number;
}

export interface AssessmentSubmissionStrategy {
  submitAssessment(
    context: AssessmentSubmissionContext,
    session: AssessmentSession,
  ): AssessmentSubmissionReceipt | Promise<AssessmentSubmissionReceipt>;
}

export interface AssessmentSubmissionFactoryDefaults {
  createPersistenceOnlySubmission(): AssessmentSubmissionStrategy;
}

export interface AssessmentPlayerHooks {
  createAssessmentSubmission?: (
    context: AssessmentSessionPersistenceContext,
    defaults: AssessmentSubmissionFactoryDefaults,
  ) => AssessmentSubmissionStrategy | Promise<AssessmentSubmissionStrategy>;
}

export interface AssessmentControllerHandle {
  submit(): Promise<AssessmentSubmissionReceipt>;
  getSubmissionState(): AssessmentSubmissionState;
}

export type AssessmentSubmissionState =
  | { status: "idle" }
  | { status: "submitting"; idempotencyKey: string }
  | {
      status: "submitted";
      idempotencyKey: string;
      receipt: AssessmentSubmissionReceipt;
    }
  | {
      status: "failed";
      idempotencyKey: string;
      kind: AssessmentSubmissionFailureKind;
      retryAfterMs?: number;
    };
```

Failures may instead be a discriminated result (see Open Questions); review
chooses one canonical path, and only that one ships.

### Submission sequence

1. Synchronize the current section snapshot into the assessment session.
2. Persist the final pre-submission snapshot through the existing strategy, in
   the same call-order queue as every other save.
3. Generate one idempotency key for this logical submission and retain it for
   retries during the controller lifetime.
4. Enter `submitting` and emit one submission-state event.
5. Call the submission strategy with a cloned canonical session snapshot.
6. On success, enter `submitted`, retain the receipt, emit one state event, and
   persist the submitted local state if the session contract carries it.
7. On failure, enter `failed`, emit one state event, and reject `submit()` with
   the typed error. The assessment does not become locally submitted.

Concurrent `submit()` calls while one call is in flight return the same promise.
A call after success returns the accepted receipt without invoking the adapter
again. A call after failure retries with the same idempotency key.

When no host strategy is supplied, the default strategy keeps current behavior:
final persistence succeeds with a locally generated receipt.

## Compatibility

This changes the public `AssessmentControllerHandle.submit()` return type from
`Promise<void>` to `Promise<AssessmentSubmissionReceipt>`. Existing callers that
only `await controller.submit()` remain source-compatible; callers explicitly
assigning `Promise<void>` may require an update. The event name
`assessment-submission-state-changed` remains canonical, but its typed payload
must grow additively to expose status, failure kind, idempotency key, and receipt.
Event `bubbles`/`composed` behavior and emission cardinality must be checked
against current code and the
[consumer API dependencies record](../integrations/consumer-api-dependencies.md)
before implementation.

The PRD does not touch versioned PIE tags, contract IDs, item-player properties,
item events, or section session shapes. It does affect assessment submission and
host-facing runtime state, so implementation updates the consumer API
dependencies record or records the verified no-row-change trailer its
[maintenance procedure](../integrations/consumer-api-dependencies-maintenance.md#enforcement)
requires.

No compatibility shim, duplicate submit method, or `backend.assessment` bridge is
introduced.

## Data Ownership And Host Responsibilities

PIE owns the browser lifecycle, canonical session snapshots, operation ordering
and observable state at its controller interfaces; backends own durable storage,
authorization, conflict policy, retention, reporting and workflow. For
submission:

PIE owns:

- Submission operation ordering and single-flight behavior.
- Stable idempotency-key reuse for one logical submission.
- The canonical assessment snapshot passed to the adapter.
- Controller submission state, event cardinality, retry behavior, and receipt
  observability.
- Keeping local state editable after a failed finalization.

Hosts own:

- The adapter implementation and backend endpoint or protocol.
- Durable idempotency enforcement and conflict policy.
- Authentication, authorization, retention, privacy, and audit storage.
- Mapping a backend response into the PIE receipt and failure vocabulary.
- Reporting, gradebooks, workflow, and standards certification.

## Serialization And Versioning

This PRD defines adapter-facing runtime data, not a mandated network payload.
`AssessmentSession` remains the canonical versioned snapshot passed to the
adapter. The receipt is opaque except for `id` and optional `submittedAt`;
`metadata` is host-owned and PIE round-trips it only in runtime state.

The idempotency key is opaque and must not encode or mutate `assessmentId` or
`attemptId`. Unknown receipt metadata fields are preserved by the host adapter;
PIE does not interpret them. There is no downgrade path to a duplicate submit
method.

Open review must decide whether the idempotency key and accepted receipt join the
persisted assessment session. If they do, the PRD must be revised before `Ready`
to define a named schema version, validation, unknown-version behavior, and
round-trip fixtures.

## Accessibility

No new widget is required. Host and built-in chrome must be able to derive an
accessible status from `AssessmentSubmissionState`:

- `submitting` disables duplicate activation without removing focus.
- success is announced once through an existing or dedicated polite status
  region.
- failure keeps focus at the submit control and exposes a concise recoverable
  message; it must not rely on color alone.
- a retry uses the same control and remains keyboard operable.
- indeterminate progress does not use motion as its only state indicator and
  respects reduced-motion preferences.

## Standards Or Adapter Impact

The receipt and final snapshot are adapter-friendly but claim no conformance.
An LTI adapter may map the operation to its own attempt/grade workflow. QTI/PCI,
xAPI, and Caliper projections remain separate contracts and packages.

## Test Plan

Required persistent evidence:

- Controller tests for success, typed failure, retry with the same idempotency
  key, concurrent single-flight calls, and repeated calls after success.
- Ordering tests proving final snapshot persistence occurs before authoritative
  submission and failure does not mark the controller submitted.
- Event tests for exactly one transition event per state and unchanged event
  initialization.
- Hook tests for factory caching and the persistence-only default.
- Assessment-player tests proving the current section snapshot reaches the
  submitted assessment session.
- Demo-backed Playwright coverage for disabled-during-submit, success
  announcement, recoverable failure, keyboard retry, and no duplicate request.
- One integrated demo and test that exercise assessment persistence, section
  persistence, derived item delivery and final submission in one attempt, so
  ownership and duplicate saves are observable. The assessment demos'
  persistence lab (`assessment-persistence-lab.spec.ts`) covers assessment
  saves, their ordering and a rejected submission over HTTP, and wires no
  section persistence or item backend delivery.
- Consumer-impact verification for `submit()` and submission event payloads.

Commands: `bun run typecheck`, `bun run test`, and the
[high-value checks](../../AGENTS.md#high-value-checks) for a player change.
Playwright-backed tests run outside the sandbox; see
[Playwright and sandboxed execution](../../AGENTS.md#playwright-and-sandboxed-execution).

## Rollout And Release Notes

- Changeset required: yes, patch under fixed lockstep versioning.
- Migration notes: document the new return value and richer submission states;
  existing `await submit()` callers need no behavioral change when using the
  default strategy.
- Documentation updates: assessment-player client tutorial, backend support,
  assessment demo, LTI integration, and the consumer API dependencies record as
  required.
- Release risk: medium. The default preserves current persistence-only behavior,
  but event ordering and failed-submit state become explicit public contracts.

## Open Questions

- Must the idempotency key and successful receipt survive a page reload? If yes,
  which named field owns them in `AssessmentSession`?
- Should typed failures use `AssessmentSubmissionError` or a discriminated result?
- Does final persistence run again after a successful authoritative submission to
  store local submitted state, or is the receipt sufficient runtime truth?
- Which existing DOM event carries the richer state, and what are its current
  `bubbles`, `composed`, payload, and cardinality contracts?
- Save-failure observability: a failed `persist()` reaches the host only through
  `hooks.onError`, and the controller exposes no save state from which host
  chrome can report a recoverable failure. Does submission state cover it, or
  does the controller need a save state of its own, deepened on the existing
  interfaces rather than a new adapter namespace?
- Reset parity: both persistence strategies declare `clearSession?()`, but the
  assessment controller never calls its strategy's, and the toolkit coordinator
  calls the section strategy's only when it disposes a controller with
  `clearPersistence`. Neither layer has a reset operation with events. Should
  reset clear an accepted submission receipt, or must a submitted controller
  reject reset unless a separate host workflow authorizes it?
