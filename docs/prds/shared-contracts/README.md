# Shared Contracts PRDs

This folder will hold the PRDs that turn
[`shared-contracts-p0.md`](../../architecture/shared-contracts-p0.md) into
accepted implementation contracts.

The architecture note is directional. These PRDs will decide exact package
ownership, TypeScript names, exports, wire fields, migration behavior, and
verification requirements.

Tracking: this workstream is deliberately not tracked in an issue tracker. The
`Status:` line in each PRD plus the sequence below are the record.
[`media-asset-contract`](./media-asset-contract.md) is `Ready` as of 2026-08-09;
the rest are `Draft`.

## Draft Sequence

Recommended review and implementation order:

1. [`interaction-event-contract`](./interaction-event-contract.md)
   - Event projection vocabulary, source refs, typed event families,
     privacy/telemetry rules, and process/path fields.
   - **Rescope before review (noted 2026-08-05).** This PRD now trails its own
     implementation. `players-shared/src/instrumentation/` ships typed
     instrumentation events with `DebugPanelInstrumentationProvider`,
     `NewRelicInstrumentationProvider`, and
     `CompositeInstrumentationProvider`, plus an event bridge and provider
     resolution; `assessment-toolkit` carries an instrumentation bridge, and
     `section-player-tools-instrumentation-debugger` consumes the stream. The
     task is to document and align with what shipped — and to decide whether
     the adapter-facing projection is the same contract as the instrumentation
     stream or a separate one — not to design the vocabulary from scratch.
   - Because it is now largely descriptive, it no longer has to gate the
     others. Reviewing it first is still useful for vocabulary, but
     `score-components-and-section-outcomes` and `media-asset-contract` can
     proceed in parallel.
2. [`score-components-and-section-outcomes`](./score-components-and-section-outcomes.md)
   - Alignment to `OutcomeResponse`, `SessionScore`, item completion,
     `TestAttemptSession`, `SectionControllerSessionState`, and
     `AssessmentSession`.
   - Missing section/assessment score and completion rollup projections.
3. [`media-asset-contract`](./media-asset-contract.md)
   - Stimulus media sources, captions, transcripts, poster, accessibility
     metadata, and host storage boundaries.
   - **Review first, not third (noted 2026-08-07).** Timed media and
     sign-language support are both expected to start soon, possibly in
     parallel, which makes this a blocker for two concurrent consumers rather
     than a contract with one prospective one. It should be designed against
     both from the start and land before either writes media-handling code,
     otherwise two media vocabularies get merged later. The time-range-within-an-asset
     primitive is shared by both — Media Fragments for signing, cue ranges for
     timed media — and should be designed once here rather than deferred.
   - **Overtaken by events, then ratified (2026-08-09).** The signing consumer
     shipped first, so `MediaAssetRef`, `MediaSource`, `TextTrackRef`,
     `TranscriptRef` and `MediaFragmentRange` exist in
     `@pie-players/pie-players-shared/types`; a second catalog consumer
     (`SpokenAudioCardPayload`, recorded audio) has since exercised the same
     shape for a second media kind without a field change. The vocabulary was
     ratified against the timed-media consumer's proposed shapes before the
     release that publishes it — cue ranges fit `MediaFragmentRange` beside the
     asset, and `video-stimulus` needs nothing `MediaAssetRef` lacks. `Ready`;
     no longer a blocker for anything downstream.
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

[`../sign-language-asl-support.md`](../sign-language-asl-support.md) also
consumes `media-asset-contract` and `accessibility-runtime-patterns`, and is the
nearest-term consumer of both: unlike timed media it builds on shipped
infrastructure (`AccessibilityCatalogResolver`, `data-catalog-idref`,
`PnpPolicySource`) rather than on machinery that does not exist yet. It does not
need `interaction-event-contract` or `score-components-and-section-outcomes`,
because a signed alternate representation produces no responses and no outcomes.
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
