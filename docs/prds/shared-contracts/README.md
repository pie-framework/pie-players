# Shared Contracts PRDs

These PRDs refine the
[P0 shared contracts](../../architecture/shared-contracts-p0.md) architecture
note into implementation contracts. The note is directional; each PRD decides
exact package ownership, TypeScript names, exports, wire fields, migration
behavior and verification requirements.

Tracking: not tracked in an issue tracker by design. Each PRD's `Status:` line
is the record.

| Contract | Status | What shipped |
| --- | --- | --- |
| [Media asset contract](./media-asset-contract.md) | `Accepted`, 2026-08-09 | The media types in `@pie-players/pie-players-shared/types`, and the validation and fragment helpers in [`@pie-players/pie-players-shared/media`](../../../packages/players-shared/README.md#media-validation). Sign-language and recorded-audio catalog cards, timed-media cue ranges and the section player's per-item media region use them. |
| [Interaction event contract](./interaction-event-contract.md) | `Draft`, 2026-06-25 | None. The [instrumentation providers](../../architecture/instrumentation-providers.md) it builds on ship; the projection envelope does not. |
| [Score components and section outcomes](./score-components-and-section-outcomes.md) | `Draft`, 2026-06-25 | None. The [formative delivery contract](../formative-delivery-contract.md) ships an item aggregation and a section mastery rollup for one purpose, without source or authority. |
| [Branching and process events](./branching-and-process-events.md) | `Draft`, 2026-06-25 | None. |
| [Evidence capture metadata](./evidence-capture-metadata.md) | `Draft`, 2026-06-25 | None. |
| [Accessibility runtime patterns](./accessibility-runtime-patterns.md) | `Draft`, 2026-06-25 | None as a contract. Timed media and sign language shipped their own runtime accessibility behavior and share one toolkit rule, the read-aloud and media audio handoff. |

No `Draft` here is scheduled.
[Framework-completing work](../../architecture/framework-completing-work.md#classification)
ranks the interaction event projection and process and branching vocabulary
among the unbuilt framework-completing capabilities, and sets the evidence any of
these needs before it is scheduled.

Feature PRDs that consume these contracts live in the [parent folder](../README.md):
timed media, sign language and audio accommodations consume the media asset
contract. Composition authoring gets its own PRD and is not folded into the
shared contracts, `video-stimulus`, QTI mappings or host-specific prose.

Standards adapters wait for the shared projections. Each contract must be
precise enough for an adapter to map it without loss, and must keep PIE runtime
code standards-neutral; the [PRD ground rules](../README.md#ground-rules) say
where each adapter lives.
