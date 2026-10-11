# PRDs

This folder holds the product requirement documents (PRDs) that turn
architecture notes into implementation-ready contracts. A PRD is concrete enough
for a reviewer to verify scope, ownership, compatibility, and test coverage
before code lands.

Architecture notes may describe direction before names and package boundaries
are final. A PRD owns the implementation decision: exact TypeScript names,
exports, wire fields, migration behavior, host responsibilities, and acceptance
tests.

## What Earns A PRD

A change needing an implementation-ready contract before code lands: a new public
package export, custom element, event, property or wire field; a shared
runtime, session, scoring, media, evidence or accessibility contract; behavior
crossing package boundaries at the assessment, section, item, toolkit, tool,
theme or adapter level; or a plan whose scope, ownership, compatibility and test
expectations have to be settled first.

Routine bug fixes, internal refactors with no contract change, docs-only edits,
dependency bumps and release mechanics do not get a PRD. Unresolved gaps in a
drafted PRD belong in **Open Questions** rather than holding up the document.

## Status Vocabulary

The first line after a PRD's title is its status line, `Status: <word>,
YYYY-MM-DD`, dated when the PRD entered that status. The word is one of:

- `Draft` - under discussion; implementation does not start from it without
  maintainer approval.
- `Ready` - scoped and reviewable; implementation can start.
- `Accepted` - implemented and kept as the current contract reference.
- `Superseded` - replaced by a newer PRD or contract document.

A contract spanning repos keeps the one-line status and adds an
implementation-status paragraph beneath it that names, per repo, what has landed
and what is outstanding. An unscheduled `Draft` says so beneath its status line.
[`TEMPLATE.md`](./TEMPLATE.md) shows the layout.

Architecture notes under [`../architecture/`](../architecture/) use their own
status words: `Active` (governs current work, including a live per-slice
record), `Implemented` (design record of shipped work), `Design note`, and
`Architecture proposal` (direction no PRD has ratified yet).

## Retention And Cleanup

Do not delete a PRD because its implementation is complete. An `Accepted` PRD is
part of the current contract documentation: it records ownership, boundaries,
rejected alternatives, compatibility decisions, and acceptance criteria that
are not recoverable cheaply from code alone.

Delete a PRD only when it was abandoned before it governed shipped behavior and
has no decision-history value. Mark it `Superseded` when a newer document owns
the contract, link to the replacement at the top, and remove it only in a later
cleanup if no current document or code comment refers to it. Once a contract is
accepted, its PRD states current behavior and the reasons for non-obvious
decisions; implementation journals, branch chronology and release records are
cut.

The live development backlog is the set of `Draft` and `Ready` PRDs. `Accepted`
and `Superseded` PRDs are reference and history and are never presented as
planned work. [Framework-completing work](../architecture/framework-completing-work.md)
sets the evidence a backlog item needs before it is scheduled, and ranks the
unbuilt framework-completing capabilities.

## Structure

- [`TEMPLATE.md`](./TEMPLATE.md) - the required PRD sections, with a prompt for
  each.
- [`shared-contracts/`](./shared-contracts/) - the PRDs that refine the
  [P0 shared contracts](../architecture/shared-contracts-p0.md); its
  [README](./shared-contracts/README.md) records what each one shipped.
  - [`media-asset-contract.md`](./shared-contracts/media-asset-contract.md) -
    `Accepted`. The media vocabulary shared by catalog cards, the per-item media
    region and timed media, with its validation rules.
  - [`interaction-event-contract.md`](./shared-contracts/interaction-event-contract.md) -
    `Draft`. A versioned event projection with stable source references over
    the runtime events PIE already emits.
  - [`score-components-and-section-outcomes.md`](./shared-contracts/score-components-and-section-outcomes.md) -
    `Draft`. Score components carrying source, authority and denominator, and
    section and assessment outcome projections.
  - [`branching-and-process-events.md`](./shared-contracts/branching-and-process-events.md) -
    `Draft`. Branch decisions, process steps, resumability markers and
    externally graded outcomes.
  - [`evidence-capture-metadata.md`](./shared-contracts/evidence-capture-metadata.md) -
    `Draft`. Metadata for learner evidence such as recordings and uploads, and
    the host's storage, review and privacy obligations.
  - [`accessibility-runtime-patterns.md`](./shared-contracts/accessibility-runtime-patterns.md) -
    `Draft`. Focus handoff, keyboard behavior and accommodation overrides across
    media, tools, TTS and overlays.
- [`pie-727-broad-theming-contract.md`](./pie-727-broad-theming-contract.md) -
  `Accepted`. The `--pie-*` token contract, the runtime color-scheme catalog,
  and generated CSS adapters; per-surface WCAG records live in the
  [theming WCAG matrix](../architecture/pie-727-theming-wcag-matrix.md).
  Integrator guides: [How theming works](../theming/how-theming-works.md) and
  [`@pie-players/pie-theme`](../../packages/theme/README.md).
- [`tts-highlight-target-resolver.md`](./tts-highlight-target-resolver.md) -
  `Accepted`. Remapping a TTS highlight from the speech-mark range to the
  content the learner sees, for projected or transformed content. The PRD is the
  only reference for it.
- [`sign-language-asl-support.md`](./sign-language-asl-support.md) - `Accepted`.
  Item-level signed alternate representations through accessibility catalogs
  and PNP gating. Integrator guide:
  [`@pie-players/pie-tool-sign-language`](../../packages/tool-sign-language/README.md).
- [`audio-accommodations.md`](./audio-accommodations.md) - `Accepted`. The
  audio transcript as a policy-gated catalog card; where autoplay control
  belongs is an open question. Integrator guide:
  [accessibility catalogs integration guide](../accessibility/accessibility-catalogs-integration-guide.md).
- [`formative-delivery-contract.md`](./formative-delivery-contract.md) -
  `Accepted`. Try state, feedback reveal as a per-item `env` projection, and
  section mastery over the shipped client-side scoring path. Integrator guide:
  [Formative delivery](../section-player/formative-delivery.md).
- [`timed-media-section-contract.md`](./timed-media-section-contract.md) -
  `Accepted`. Section-level timed media with cue-driven item orchestration; cue
  gate conditions read formative state. Integrator guide:
  [Timed media](../../packages/section-player/README.md#timed-media).
- [`assessment-authoritative-submission.md`](./assessment-authoritative-submission.md) -
  `Draft`, unscheduled. A host-supplied terminal submission operation for the
  reference assessment player, with idempotency, typed receipts, retry
  semantics, and observable controller state.
- [`speech-to-text.md`](./speech-to-text.md) - `Draft`, unscheduled.
  Embedded dictation, an accommodation that writes the response, and the
  element-facing insertion contract it needs. Integrator guide for the
  supported non-embedded form:
  [Non-embedded dictation](../tools-and-accomodations/non-embedded-dictation.md).
- [`open-source-calculator-provider.md`](./open-source-calculator-provider.md) -
  `Accepted`. A fully bundled basic, scientific, and focused graphing provider
  built from MathLive, CortexJS Compute Engine, and JSXGraph, selected
  additively as `calculator-cortex`. Integrator guide:
  [`@pie-players/pie-calculator-cortex`](../../packages/calculator-cortex/README.md).
- [`session-commit-on-teardown.md`](./session-commit-on-teardown.md) -
  `Accepted`. A committed response reaches the host before its element is torn
  down, at item teardown, page hide and section boundaries. Integrator guide:
  [Session commit](../item-player/overview.md#session-commit).
- [`section-and-assessment-session-property.md`](./section-and-assessment-session-property.md) -
  `Accepted`. A `session` property on the section-player layouts and the default
  assessment player, applied inside controller creation before the first
  composition, plus `sectionFromItem` for hosts that deliver one item at a time.
  Integrator guide:
  [Session lifecycle](../../packages/section-player/README.md#session-lifecycle).

Decisions that span PRDs — sequencing, rejected alternatives, trade-offs a reader
would otherwise have to reconstruct — live in [`../adr/`](../adr/).

## Ground Rules

- Keep PRDs narrowly scoped to one independently reviewable contract or feature.
- Name one owning package and public export path for every public contract.
- Separate PIE-owned behavior from host-owned storage, identity, policy,
  reporting, standards certification, and backend workflow.
- Treat standards integrations as adapter consumers of PIE projections unless a
  PRD explicitly scopes and tests a concrete adapter.
- Do not claim standards conformance until the adapter and its validation suite
  exist.
- QTI/PCI adapters belong in [pie-qti](https://github.com/pie-framework/pie-qti).
  LTI, xAPI, and Caliper adapters may become separate `@pie-players/*` packages
  once the shared projection contracts exist; SCORM is out of scope for them.
- Fill every required template section; a section that does not apply says so
  explicitly.
- A contract sketch beats a long code snippet, and a link beats repeating
  architecture background already under `Related architecture`. Resolved
  questions are inlined into the section they settle, leaving no decision log.
- Cite code by file or symbol name; line numbers drift.
