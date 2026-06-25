# Evidence Capture Metadata

Status: Draft

Owner: PIE Players maintainers

Related architecture:

- [P0 shared contracts](../../architecture/shared-contracts-p0.md)

## Problem

Learners may need to submit audio, video, images, files, drawings, or mixed evidence for rubric review, vocational assessment, simulations, or externally graded workflows. PIE can define a thin evidence reference vocabulary, but the hard parts of upload, retention, privacy, review, audit, and storage belong to host systems.

Without a shared metadata contract, future evidence elements, section variants, and QTI adapters may encode evidence references incompatibly or imply that PIE owns host storage and review workflow.

## Goals

- Define learner evidence metadata separately from stimulus media metadata.
- Support references to audio, video, image, file, and mixed evidence assets.
- Link evidence to source item, section, step, branch, simulation, scenario, or rubric context.
- Make host-owned upload, storage, review, audit, and privacy boundaries explicit.
- Provide adapter-friendly data for QTI upload/drawing/file response mappings without claiming conformance.

## Non-Goals

- No upload implementation, file picker, recorder UI, media capture UI, or review UI.
- No malware scanning, retention, signed URL, consent, or permission system.
- No scorer identity, comment workflow, or rubric adjudication system.
- No storage of raw binary evidence in PIE session snapshots.
- No guarantee that evidence is scorable or complete.

## Package And Export Ownership

- Owning package: proposed `@pie-players/pie-players-shared` for metadata types.
- Public export path: open question; candidate shape is `<owner>/evidence`.
- Consuming packages or apps: future evidence elements in `pie-elements-ng`, section-player variants, assessment-toolkit, standards adapters, and hosts.
- Runtime environment: browser, Node-safe, custom element, and adapter-only.

If a future thin evidence UI is built, that element PRD should consume this metadata contract instead of redefining storage or review fields.

## Contract Shape

The final names are not ratified by this draft. The contract should represent evidence references and contextual linkage.

Documentation sketch only:

```ts
type EvidenceModality = "audio" | "video" | "image" | "file" | "drawing" | "mixed";

interface EvidenceAssetRef {
  id: string;
  uri?: string;
  mimeType?: string;
  sizeBytes?: number;
  durationSeconds?: number;
  fileName?: string;
  capturedAt?: number;
  transcript?: {
    src?: string;
    plainText?: string;
    lang?: string;
  };
  captions?: Array<{
    src: string;
    lang: string;
    label: string;
  }>;
}

interface EvidenceCaptureMetadata {
  version: 1;
  id: string;
  modality: EvidenceModality;
  assets: EvidenceAssetRef[];
  source: InteractionSourceRef;
  rubricId?: string;
  scoringContextId?: string;
}
```

The accepted contract should define whether `uri` is required, optional, or host-resolved, and how an evidence reference indicates pending upload or unavailable evidence.

## Compatibility

This PRD introduces additive metadata only. It must not change PIE element runtime contracts, item-player APIs, section session shapes, or assessment-player submission behavior by itself.

Evidence source references that include PIE elements must preserve versioned tag names and contract identifiers unchanged.

No generic evidence bag should be added to session snapshots. A future evidence slice or element session shape needs an owning PRD and tests.

## Data Ownership And Host Responsibilities

PIE owns:

- evidence metadata vocabulary;
- source-reference linkage rules;
- optional validation for metadata shape;
- adapter-friendly distinction between evidence references and stimulus media.

Hosts own:

- upload and capture pipeline;
- malware scanning;
- storage and signed URL generation;
- permissions and authorization;
- retention, deletion, privacy, consent, and audit logs;
- reviewer identity, comments, adjudication, and workflow;
- durable evidence availability guarantees.

## Serialization And Versioning

Evidence metadata is wire-facing data and requires:

- `version: 1`;
- validation by the owning package;
- explicit representation of pending, unavailable, or externally stored evidence;
- unknown-version rejection for state-bearing evidence metadata;
- fixtures for each modality, multiple assets, transcript/caption metadata, missing URI, and rubric linkage.

Binary content must not be embedded in this contract. Inline transcript text may be allowed if the accepted contract defines size and privacy expectations.

## Accessibility

Evidence UI PRDs that consume this metadata must define:

- keyboard-accessible capture and file-selection flows;
- accessible labels and status announcements for upload/capture state;
- alternatives for audio/video evidence when required by policy;
- transcript or caption handling when evidence is reviewed by assistive technology users;
- clear error and retry messaging.

This metadata PRD does not implement UI behavior.

## Standards Or Adapter Impact

This contract should support QTI upload/drawing/file response mappings and future xAPI/Caliper evidence statements. It does not claim standards conformance.

QTI evidence mapping belongs in `../pie-qti` after this contract is accepted.

## Test Plan

Required test coverage:

- fixtures for audio, video, image, file, drawing, and mixed evidence;
- fixtures for pending and externally stored evidence references;
- tests that evidence source references preserve PIE tag/id identity;
- adapter round-trip fixtures once `../pie-qti` consumes the accepted contract;
- accessibility test plans for any future UI that captures or displays evidence.

Commands:

```sh
bun run typecheck
bun run test
```

For custom-element or export-boundary changes, also run:

```sh
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

## Rollout And Release Notes

- Changeset required: yes, if public exports are added.
- Migration notes: additive metadata contract; no evidence storage is introduced.
- Documentation updates: future evidence UI and adapter PRDs should link to this contract.
- Release risk: medium-high, because evidence metadata touches privacy-sensitive workflows even when storage is host-owned.

## Open Questions

- What is the minimum useful evidence metadata that does not imply storage ownership?
- How should pending upload or temporarily unavailable evidence be represented?
- Should drawings be treated as image evidence, file evidence, or a separate modality?
- Are reviewer comments and rubric annotations explicitly out of scope forever, or only for the first version?
