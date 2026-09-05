# Delivery Reliability And Accessibility Remediation Plan

Status: Active — remediation plan and issue register.

Owner: PIE Players maintainers

Tracking: this file owns issue status, branch assignments, dependencies, and
completion evidence. R1–R4 refer to the four findings from the 2026-09-05 project
review; R5 records the dependency-audit blocker found when its first repair PR
ran CI. These are local tracking identifiers, not external tickets.

Review baseline: `develop` at `0dc255865176322c08247b3a2b568df4b7b4833b`.

Related:

- [Assessment lifecycle and persistence decision plan](./assessment-player-lifecycle-persistence-implementation-plan.md) — technical scope and host-evidence gates for assessment changes
- [Consumer API dependencies](../integrations/consumer-api-dependencies.md) — observed integration surfaces
- [Accessibility evaluation method](../wcag/evaluation-method.md) — browser, keyboard, and assistive-technology evidence
- [Framework-completing and product-completing work](./framework-completing-work.md) — ownership boundaries

## Priority And Issue Register

The four original findings are P1. Fix shared zoom behavior first because it affects
existing section and tool surfaces. Treat the other three as blockers before
production adoption of the assessment player. The consumer inventory records no
external assessment-player consumer; the review did not refresh downstream
checkouts, so verify that observation before relying on it during implementation.
R5 is an independent dependency-audit blocker and can proceed while R4 is in review.

| Order | Issue | Branch | Status | PR / merge evidence |
| --- | --- | --- | --- | --- |
| 0 | [R5 — A shipped XML dependency blocks the security audit](#r5--a-shipped-xml-dependency-blocks-the-security-audit) | `codex/fix-xmldom-audit` | In progress | Patched runtime and full local PR gate verified; separate PR next. |
| 1 | [R4 — Accommodation controls shrink in constrained viewports](#r4--accommodation-controls-shrink-in-constrained-viewports) | `codex/fix-zoom-compensation` | In review | [Draft PR #375](https://github.com/pie-framework/pie-players/pull/375); implementation `6c089fdb`. Consumer verification remains pending; the PR records its evidence. |
| 2 | [R3 — Assessment mounting and readiness are inconsistent](#r3--assessment-mounting-and-readiness-are-inconsistent) | `codex/fix-assessment-lifecycle` | Planned | — |
| 3 | [R1 — Returning to a section loses answers](#r1--returning-to-a-section-loses-answers) | `codex/fix-assessment-answer-restoration` | Planned | — |
| 4 | [R2 — Saves race and submission can falsely succeed](#r2--saves-race-and-submission-can-falsely-succeed) | `codex/fix-assessment-persistence` | Planned | — |

R4 is independent of the assessment fixes. R1 builds on R3's lifecycle ownership.
R2's final navigation, active-answer, and reload verification uses R3 and R1;
its host-boundary investigation can happen earlier. These are sequential repair
branches, each based on `develop`, with one issue per PR. Independent repairs
may proceed while another PR is in review; dependent repairs start after their
prerequisites are integrated. R5 carries no R4 implementation changes.

## Working And Tracking Rules

Use the existing checkout. Worktrees are unnecessary for this sequence.

1. Commit this plan before starting repairs so each branch inherits the tracker.
   The planning commit lands with the first repair PR.
2. Start each repair from a clean, current `develop`; create the branch named in
   the register and change its row to `In progress`. Keep the issue's source,
   regression tests, integration docs, and patch changeset together.
3. Complete the issue checklist and applicable validation below. Set the row to
   `In review` when its PR is open; record the PR link, tested commit, results,
   and any remaining limitations in the evidence cell or a linked PR section.
4. Mark `Done` only after the fix is verified and merged into `develop`. Record
   the PR, merge commit, and date in this file, including a follow-up tracker
   update when the merge result was not available in the repair PR.
5. Return to `develop`, incorporate the merge, and remove the completed issue
   branch once its work is confirmed integrated. Start the next branch there.

The status vocabulary is `Planned`, `In progress`, `In review`, `Blocked`, and
`Done`. A blocked row names the missing evidence or dependency and the next
action needed; elapsed time and a passing unit test do not close it. If blocked
work is parked, commit it on its issue branch before switching away. There is
no need to create a worktree merely to keep that branch available.

This register tracks the work in the repository. Update it in the same change
that changes scope or progress; no separate issue tracker is required.

## R5 — A Shipped XML Dependency Blocks The Security Audit

**Observed failure.** The dependency-audit job on R4 reports
[GHSA-6gmq-8vp8-gcm6](https://github.com/advisories/GHSA-6gmq-8vp8-gcm6)
against `@xmldom/xmldom` 0.9.10, reached through the toolkit's existing
`speech-rule-engine` dependency. The same dependency set is on `develop`.
This is an upstream XML validation defect and a failing shipped-dependency
gate; no exploitable assessment-content path has been established.

Work and acceptance:

- [x] Reproduce the audit finding and the upstream entity-name validation
  failure through Speech Rule Engine's actual installed XML resolution.
- [x] Select upstream's patched 0.9.12 release without upgrading unrelated
  dependencies or changing the math-speech API.
- [x] Confirm the installed runtime, not just the lockfile, rejects invalid
  entity names at creation and during well-formed serialization while retaining
  valid entity serialization.
- [x] Rebuild consumers and verify real MathML-to-speech/SSML behavior, package
  checks, and the local PR gate. Confirm `bun run check:audit` has no blocking
  shipped findings.
- [ ] Record the separate PR and its validation. The workspace override covers
  builds here; hosts resolving external Speech Rule Engine need their own
  lockfile refresh, because overrides do not propagate through published packages.

Validation on 2026-09-05:

- Speech Rule Engine's installed dependency resolves to 0.9.12. A direct runtime
  probe rejects an invalid entity name both at creation and with
  `requireWellFormed: true` serialization after a name mutation; valid entity
  serialization remains unchanged. The same probe failed both rejection checks
  with 0.9.10. A forced frozen install was needed to refresh an existing isolated
  dependency link after the initial lockfile update.
- The math speech, TTS math service, and generated SSML Bun suites pass all
  33 tests / 107 assertions, including real MathML-to-speech conversion.
- `bun run verify:local-pr` passes: workspace build, lint/typecheck, package and
  consumer checks, 191 script tests, and 93 critical browser tests across section,
  item, assessment, shared, and print players. Browser coverage includes generated
  math speech and highlighting.
- `bun run check:audit` reports zero shipped findings. One existing moderate
  development-only Tiptap finding remains non-blocking under the audit policy.
- The only changed resolved third-party package is `@xmldom/xmldom`. Bun also
  refreshed 51 workspace version metadata entries to match existing manifests;
  no package versions or release policy changed.

## R4 — Accommodation Controls Shrink In Constrained Viewports

**Observed failure.** At a 320 × 800 content viewport, with `outerWidth` 1768,
`devicePixelRatio` 1, and `visualViewport.scale` 1, the width-ratio estimator
produces about 552% zoom. The plain read-aloud trigger measures about 3.66 × 3.66
CSS pixels and Passage/Questions tabs about 10.55 pixels high. The plain TTS
trigger receives compensation on both its wrapper and its control class.

**Code entry points:** [shared calculation](../../packages/players-shared/src/ui/zoom-compensation.ts),
[reactive wrapper](../../packages/players-shared/src/ui/use-zoom-compensation.svelte.ts),
[inline TTS](../../packages/tool-tts-inline/tool-tts-inline.svelte),
[section tabs](../../packages/section-player/src/components/shared/SectionPlayerTabbedContent.svelte),
[item toolbar](../../packages/assessment-toolkit/src/components/ItemToolBar.svelte),
and [section scroll hint](../../packages/section-player/src/components/shared/SectionItemsPane.svelte).

Work and acceptance:

- [ ] Reproduce constrained-host and ordinary-window cases separately from
  actual browser zoom. Record dimensions, browser zoom, computed scaling, and
  rendered target bounds for plain and NDS controls.
- [ ] Remove width-ratio-only inference as a reason to shrink controls. Compare
  removing compensation with the existing cap's intended behavior at real
  magnification before choosing a replacement. Keep the result shared across
  callers and apply any retained compensation once per rendered control.
- [ ] At 100% zoom, a narrow host viewport must not shrink controls merely
  because the outer browser window is wider. Verify 320px, 375px, and desktop
  widths in standalone section and nested assessment delivery.
- [ ] Verify actual 200% text enlargement and 400% browser zoom/reflow, including
  readable tabs, usable controls, scrolling, keyboard access, focus visibility,
  and tool panels. Record target size or the applicable spacing exception under
  WCAG 2.5.8; the original small-target measurement alone is not a conformance
  verdict. Viewport emulation is not evidence of actual browser magnification.
- [ ] Add behavior coverage to the shared zoom and section reflow tests; retain
  theme/focus contracts and verify the changed controls with an axe scan and
  manual keyboard checks. Record manual zoom evidence alongside automated
  results rather than relying on mathematical ratio tests alone.

Start with [shared zoom tests](../../packages/players-shared/tests/use-zoom-compensation.test.ts)
and [section reflow tests](../../packages/section-player/tests/section-player-reflow.spec.ts).
Use the [WCAG baseline](../wcag/wcag-2.2-aa-baseline.md) and evaluation method for
the affected surfaces. This repair does not require palette or token redesign.

## R3 — Assessment Mounting And Readiness Are Inconsistent

**Observed failure.** Connecting the custom element before assigning its
assessment, as documented, leaves a required-input error and no controller.
Assigning inputs before connection invokes the ready hook twice. Rejecting
`loadSession()` still allows initialization to finish with readiness `ready`.

**Code entry points:** [assessment custom element](../../packages/assessment-player/src/components/AssessmentPlayerDefaultElement.ts),
[assessment controller](../../packages/assessment-player/src/controller/AssessmentController.ts),
and [documented host mounting](../assessment-player/client-architecture-tutorial.md).

Work and acceptance:

- [ ] Complete the consumer check and public host fixture in the
  [decision plan](./assessment-player-lifecycle-persistence-implementation-plan.md#compatibility-boundary).
  Remove demo dependence on private bootstrap calls as part of this issue.
- [ ] Implement one reconciliation and readiness owner for documented object
  property updates, successful initialization, and observable failures. Meet the
  decision plan's [lifecycle outcomes](./assessment-player-lifecycle-persistence-implementation-plan.md#decisions-supported-now).
- [ ] Complete its [public lifecycle regression cases](./assessment-player-lifecycle-persistence-implementation-plan.md#required-black-box-evidence):
  post-connect input assignment, exactly-once readiness, failed hydration,
  superseded initialization, disconnect/reconnect, truthful controller access,
  and owned-versus-borrowed disposal. Show a usable, accessible error state when
  initialization fails; a failure must not masquerade as a ready assessment.
- [ ] Use the existing coordinator lifecycle API. Verify the baseline
  [disposal regression suite](../../packages/assessment-toolkit/tests/toolkit-coordinator-disposal.test.ts)
  and extend it only if the assessment integration exposes a new failure.
- [ ] Verify the built custom-element entry and a clean package consumer against
  the public mounting tutorial. Preserve navigation focus and announcements.

The coordinator disposal prerequisite is already present on the review baseline
in `e3169f8b`; adopting it does not need a separate implementation branch. This
issue owns initialization/load failures; R2 owns save/submission failures.

## R1 — Returning To A Section Loses Answers

**Observed failure.** In the assessment demo's `/three-section-assessment` flow,
select A in the first question, choose Next, then Back. The selection disappears,
although it was present in the outgoing section session. This reproduced twice
at desktop width. Source tracing points to the restoration waiter being queued
before the replacement subtree connects, then returning when its exported
controller waiter is unavailable.

**Code entry points:** `attachSectionControllerReadyListener()` and section
mounting in the [assessment custom element](../../packages/assessment-player/src/components/AssessmentPlayerDefaultElement.ts),
plus section-session capture in the [assessment controller](../../packages/assessment-player/src/controller/AssessmentController.ts).

Work and acceptance:

- [ ] Add a public browser regression with real item content and confirm the
  exact mount/readiness failure before changing the handoff.
- [ ] Capture the outgoing session before replacing its section. Obtain the
  connected section's ready controller through the canonical public path, and
  apply the saved snapshot before accepting empty replacement-session updates.
- [ ] Scope restoration and subscriptions to the active assessment, attempt,
  and section. Reuse R3's lifecycle invalidation so delayed work from a retired
  section cannot apply or publish into the current one.
- [ ] Verify answer → Next → Back through all sections, then save and reload
  through a persistent browser fixture. Assert the visible answer and session
  contents, including retained formative and timed-media slices when present.
- [ ] Exercise rapid navigation, delayed readiness, failed restoration, and
  disconnect during restoration. Failure must remain observable and leave the
  saved answer intact. Preserve current navigation focus, section announcements,
  and standalone section reflow behavior.

Extend the [assessment browser suite](../../packages/assessment-player/tests/assessment-player-smoke.spec.ts)
and retain [session slice round-trip coverage](../../packages/assessment-player/tests/assessment-session-slice-round-trip.test.ts).
Use a successful persistence adapter to isolate this handoff repair; R2 adds
adversarial save completion and failure scenarios to the same journey.

Repair the existing in-memory handoff without inventing a new durable owner or
section-controller acquisition mode. If either becomes necessary, resolve the
[host-evidence gate](./assessment-player-lifecycle-persistence-implementation-plan.md#decisions-that-need-host-evidence)
before expanding this issue.

## R2 — Saves Race And Submission Can Falsely Succeed

**Observed failure.** Two `persist()` calls can write concurrently. Completing
the newer immutable snapshot first and the older one last leaves stored section
index 0 while the controller is at index 1. When `saveSession()` rejects,
`submit()` still resolves, retains `submitted: true`, and has already emitted
that success state.

**Code entry point:** `persist()` and `submit()` in the
[assessment controller](../../packages/assessment-player/src/controller/AssessmentController.ts),
with the host's existing `AssessmentSessionPersistenceStrategy` implementation.

Work and acceptance:

- [ ] Establish a representative host's read/write boundary first: who owns
  durable state, which actions save, when a write is acknowledged, how a reload
  selects state, and what rejection or an uncertain network outcome means.
  Record a redacted integration reference and the selected behavior in the PR,
  following the [decision plan's evidence gate](./assessment-player-lifecycle-persistence-implementation-plan.md#decisions-that-need-host-evidence).
  If no representative host is available, mark this issue `Blocked` with that
  missing input; an in-memory demo alone cannot close this gate.
- [ ] Select the smallest repair through the existing strategy: define the
  stable snapshot boundary, ordering or coalescing behavior, and observable
  failure result. Ensure an older write cannot overwrite newer acknowledged
  state within the same assessment attempt. Keep attempts and retired
  controllers isolated.
- [ ] Make submission await the current active answer and its required final
  save. Publish successful submission only after that save succeeds. A rejected
  save must be observable to the caller and leave the assessment recoverable;
  define repeated/concurrent submission calls and edits during a pending save
  against the recorded host contract.
- [ ] Add deterministic controller tests with deferred saves and immutable
  snapshots. Cover reverse completion, state changes while hooks await,
  rejected hooks/writes, recovery after failure, duplicate submission calls,
  and late completion from a retired attempt. Assert stored values and public
  outcomes, not a particular queue implementation.
- [ ] Re-run R1's real-content answer/navigation/reload journey at the host's
  actual storage boundary with delay and failure injection. Verify the last
  accepted answer survives, errors reach the host, and save failure never
  yields a successful submission signal. Record remaining host limitations.

This issue repairs snapshot-save ordering and truthful local submission
behavior. The [authoritative submission PRD](../prds/assessment-authoritative-submission.md)
remains Draft: backend finalization, receipts, idempotency, and remote recovery
contracts require its separate acceptance. A successful snapshot save must not
be documented as proof of authoritative backend finalization.

## Validation And Completion

For each issue, promote the relevant review reproduction into a regression
test that fails before the repair and passes afterward. Use public custom-element
or controller boundaries; source-string and private-method assertions cannot
substitute for the observed failure. The review's passing tests are baseline
evidence, not evidence that any issue is fixed.

Follow [AGENTS.md](../../AGENTS.md) for consumer-impact checks, patch changesets,
build order, and release alignment. Refresh the consumer pad using its
[maintenance procedure](../integrations/consumer-api-dependencies-maintenance.md)
when required; keep downstream-private details out of repository documentation.

Rebuild changed packages and their direct `dist` consumers before browser
verification. Run focused Bun tests and browser cases while developing, then
the applicable source-export, consumer-boundary, custom-element,
capability-neutrality, and player/tool-boundary checks. Before merging each
repair, run `bun run verify:local-pr`, which includes the critical browser
suites. Run Playwright with the unrestricted execution required by the project.
Record real-browser zoom and manual accessibility results separately from that
automated gate.

The repair is complete when its acceptance checklist is satisfied, relevant
public docs and patch changeset are included, verification evidence is recorded,
and the PR has landed on `develop`. The overall plan is complete when all five
rows are `Done` and the integrated answer/navigation/reload/submission journey
passes on the resulting `develop`. Then follow the
[documentation retention policy](../prds/README.md#retention-and-cleanup): retain
current contracts and regression tests, and retire the completed plan from the
live backlog.
