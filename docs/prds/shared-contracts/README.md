# Shared Contracts PRDs

This folder will hold the PRDs that turn
[`shared-contracts-p0.md`](../../architecture/shared-contracts-p0.md) into
accepted implementation contracts.

The architecture note is directional. These PRDs will decide exact package
ownership, TypeScript names, exports, wire fields, migration behavior, and
verification requirements.

## Draft Sequence

Recommended review and implementation order:

1. [`interaction-event-contract`](./interaction-event-contract.md)
   - Event projection vocabulary, source refs, typed event families,
     privacy/telemetry rules, and process/path fields.
2. [`score-components-and-section-outcomes`](./score-components-and-section-outcomes.md)
   - Alignment to `OutcomeResponse`, `SessionScore`, item completion,
     `TestAttemptSession`, `SectionControllerSessionState`, and
     `AssessmentSession`.
   - Missing section/assessment score and completion rollup projections.
3. [`media-asset-contract`](./media-asset-contract.md)
   - Stimulus media sources, captions, transcripts, poster, accessibility
     metadata, and host storage boundaries.
4. [`branching-and-process-events`](./branching-and-process-events.md)
   - Branching, simulations, replay/debug, resumability, externally graded
     outcomes, and path state.
5. [`evidence-capture-metadata`](./evidence-capture-metadata.md)
   - Learner evidence metadata and host-owned storage, review, audit, and
     privacy responsibilities.
6. [`accessibility-runtime-patterns`](./accessibility-runtime-patterns.md)
   - Focus handoff, media/tool/TTS coordination, overlays, keyboard behavior,
     accommodation overrides, and assistive technology expectations.

Timed-media implementation PRDs consume the shared contracts above and live
outside this folder. The first planned timed-media PRD is
[`../timed-media-section-contract.md`](../timed-media-section-contract.md).
Composition authoring is a later PRD and should not be folded into the shared
contracts, `video-stimulus`, QTI mappings, or host-specific prose.

## Adapter Track

Adapter packages should wait until the shared projections above exist.

- QTI/PCI mapping belongs in `../pie-qti`, consuming PIE projection contracts.
- LTI, xAPI, and Caliper may become separate `@pie-players/*` adapter packages
  in this repo.
- SCORM is out of scope for this PRD track.

The shared contracts should be precise enough for adapters to avoid lossy
mappings, but they should not make PIE runtime code standards-specific.
