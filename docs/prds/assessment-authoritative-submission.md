# Assessment Authoritative Submission

Status: Draft

Owner: `@pie-players/pie-assessment-player`

Related architecture:

- [Backend support](../item-player/backend-support.md)
- [Assessment player client architecture](../assessment-player/client-architecture-tutorial.md)
- [Framework-completing and product-completing work](../architecture/framework-completing-work.md)
- [Consumer API dependencies](../integrations/consumer-api-dependencies.md)

## Problem

`AssessmentController.submit()` currently marks the local controller submitted,
emits `assessment-submission-state-changed`, and saves the final
`AssessmentSession` through `AssessmentSessionPersistenceStrategy`. That is enough
for local lifecycle state, but it cannot represent a backend that must finalize
an attempt exactly once, reject a conflict, return an authoritative receipt, or
recover after an indeterminate request.

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
- No assessment or section definition loading.
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
- Consuming packages or apps: assessment-player hosts, assessment demos, and LTI
  adapters; section-player and item-player do not consume this contract.
- Runtime environment: browser custom-element/controller interface with a
  host-supplied adapter.

The canonical types live beside `AssessmentPlayerHooks`,
`AssessmentSessionPersistenceStrategy`, and `AssessmentControllerHandle`. No
consumer redefines them.

## Contract Shape

Documentation sketch:

```ts
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

The exact failure representation may use a discriminated result instead of a
class; review should choose one canonical path, not support both.

### Submission sequence

1. Synchronize the current section snapshot into the assessment session.
2. Persist the final pre-submission snapshot through the existing strategy.
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

When no host strategy is supplied, the default strategy preserves current
behavior: final persistence succeeds with a locally generated receipt. This is
an evolution of the existing assessment-player interface, not a legacy alias.

## Compatibility

This changes the public `AssessmentControllerHandle.submit()` return type from
`Promise<void>` to `Promise<AssessmentSubmissionReceipt>`. Existing callers that
only `await controller.submit()` remain source-compatible; callers explicitly
assigning `Promise<void>` may require an update. The event name
`assessment-submission-state-changed` remains canonical, but its typed payload
must grow additively to expose status, failure kind, idempotency key, and receipt.
Event `bubbles`/`composed` behavior and emission cardinality must be checked
against current code and the consumer dependency pad before implementation.

The PRD does not touch versioned PIE tags, contract IDs, item-player properties,
item events, or section session shapes. It does affect assessment submission and
host-facing runtime state, so implementation must update the consumer dependency
pad or record the required verified no-row-change rationale.

No compatibility shim, duplicate submit method, or `backend.assessment` bridge is
introduced.

## Data Ownership And Host Responsibilities

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
- Consumer-impact verification for `submit()` and submission event payloads.

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

Playwright-backed tests run outside the sandbox.

## Rollout And Release Notes

- Changeset required: yes, patch under fixed lockstep versioning.
- Migration notes: document the new return value and richer submission states;
  existing `await submit()` callers need no behavioral change when using the
  default strategy.
- Documentation updates: assessment-player client tutorial, backend support,
  assessment demo, LTI integration, and consumer dependency pad as required.
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
- Should reset clear an accepted submission receipt, or must a submitted
  controller reject reset unless a separate host workflow authorizes it?
