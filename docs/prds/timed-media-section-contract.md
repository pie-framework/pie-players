# Timed Media Section Contract

Status: Draft

Owner: PIE Players maintainers

Related architecture:

- [Timed media section architecture](../architecture/timed-media-section.md)
- [P0 shared contracts](../architecture/shared-contracts-p0.md)
- [Media asset contract](./shared-contracts/media-asset-contract.md)
- [Interaction event contract](./shared-contracts/interaction-event-contract.md)
- [Score components and section outcomes](./shared-contracts/score-components-and-section-outcomes.md)
- [Accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md)

## Problem

Video-linked assessment is a high-value gap because it combines shared media stimulus, timestamp cues, normal PIE child items, playback policy, completion, and score aggregation. The architecture should be implemented as section-level composition, not as one opaque element or a full assessment-player replacement.

This PRD defines the section contract that timed-media section-player variants, assessment-player renderer selection, `video-stimulus`, and future adapters can align around.

## Goals

- Define timed media as a section flavor with normal child item refs and normal child item sessions.
- Keep `video-stimulus` responsible for media rendering and playback APIs only.
- Define cue metadata, cue policy, playback policy, media/cue session state, and section completion behavior.
- Preserve existing section item-session behavior while adding a named typed `timedMedia` section slice.
- Provide adapter-friendly events and outcome projections by consuming shared contracts.

## Non-Goals

- No item bank, media repository, catalog, workflow, rostering, scheduling, gradebook, backend reporting, or durable attempt store.
- No opaque PCI/custom-item wrapper that hides normal child item/session/outcome structure.
- No cue-to-question orchestration inside `video-stimulus`.
- No generic `profileState` bag for section behavior.
- No composition authoring UI in this PRD; that is a future PRD for cue timelines, item bindings, preview, and policy editing.
- No final QTI profile or conformance claim; QTI mapping belongs in `pie-qti` after this contract is reviewed.

## Package And Export Ownership

- Owning package: proposed `@pie-players/pie-players-shared` for timed-media section data types, with `@pie-players/pie-assessment-toolkit` owning runtime slice helpers if needed.
- Public export path: open question; candidate shape is shared section type exports plus toolkit controller helpers.
- Consuming packages or apps: `section-player`, `assessment-player`, `assessment-toolkit`, `apps/section-demos`, `apps/assessment-demos`, `pie-elements-ng` `video-stimulus`, and `pie-qti` adapters.
- Runtime environment: browser and custom element; data types should be Node-safe for adapters.

Implementation must choose one canonical type home for `sectionType`, `timedMedia`, cues, and the timed-media session slice.

## Contract Shape

The final names are not ratified by this draft. The section shape should extend existing section data additively.

Documentation sketch only:

```ts
interface TimedMediaCue {
  identifier: string;
  startTime: number;
  endTime?: number;
  itemRefs: string[];
  policy: {
    activation: "reveal" | "pause-and-require-response" | "metadata";
    allowResumeBeforeResponse?: boolean;
  };
}

interface TimedMediaSectionData {
  sectionType: "timed-media";
  timedMedia: {
    media: MediaAssetRef;
    cues: TimedMediaCue[];
    playbackPolicy: {
      allowSeekAhead: boolean;
      pauseOnRequiredCue: boolean;
      requireMediaCompletion: boolean;
    };
    scoringPolicy?: {
      strategy: "sum-child-outcomes" | "average-child-outcomes" | "weighted-child-outcomes" | "host-defined";
    };
  };
}

interface TimedMediaSectionSessionSlice {
  version: 1;
  mediaCurrentTime: number;
  mediaCompleted: boolean;
  visitedCueIdentifiers: string[];
  completedCueIdentifiers: string[];
  activeCueIdentifier?: string;
  aggregateComplete?: boolean;
}
```

The existing section snapshot remains the base. The named `timedMedia` slice must define merge and replace behavior explicitly.

## Compatibility

This PRD extends `section-player` behavior additively. It must not change:

- PIE element runtime/controller contracts;
- `pie-item-player` properties, events, or imperative APIs;
- normal child item session propagation;
- existing section-player layouts unless they opt into timed-media behavior;
- assessment-player routing except for additive renderer selection.

The timed-media slice must not become a generic profile bag. Unknown hosts must follow the slice behavior ratified by this PRD, not invent alias maps, fallback normalizers, or duplicate dispatch paths.

Element source references and child item markup must preserve versioned PIE tag names and contract attributes unchanged.

## Data Ownership And Host Responsibilities

PIE owns:

- timed-media section data vocabulary;
- cue and playback policy semantics;
- media/cue session slice behavior;
- section-player orchestration of media, cues, child item reveal, and completion;
- adapter-friendly projections derived from shared contracts.

Hosts own:

- media hosting, signed URLs, CDN, CSP, authorization, retention, and privacy;
- durable attempt persistence;
- item lookup/storage;
- product workflow, scheduling, gradebooks, and reporting;
- composition authoring unless a future PIE package explicitly scopes it.

## Serialization And Versioning

The timed-media section data and session slice are persisted or wire-facing data and require:

- `version: 1` on the `timedMedia` session slice;
- validation by the owning package;
- replace semantics for host-provided section data;
- merge semantics for runtime session updates;
- hydrate behavior from persisted section snapshots;
- unknown-version rejection for runtime delivery;
- unknown-host behavior: reject unknown `timedMedia.version` and do not round-trip untyped timed-media state.

Round-trip fixtures must cover media progress, cue visits, cue completion, active cue, aggregate completion, and child item sessions.

## Accessibility

Timed-media delivery must satisfy WCAG 2.2 AA and consume the accessibility runtime patterns PRD:

- all media controls are keyboard accessible and labelled;
- cue activation is announced to assistive technology;
- focus moves predictably when playback pauses and an item appears;
- captions and transcripts remain available during cue-linked questions;
- overlays must not obscure captions, transcripts, controls, or essential media;
- seek locks must not trap keyboard or assistive-technology users;
- TTS/media handoff rules prevent overlapping speech and media audio;
- high-contrast, zoom, touch, and reduced-motion behavior must be verified.

## Standards Or Adapter Impact

This PRD produces adapter-friendly data for QTI/PCI, xAPI, and Caliper. It does not claim standards conformance.

QTI import/export profile work belongs in `pie-qti` after this contract and its shared dependencies are reviewed. Opaque PCI wrapping of the whole timed-media experience is rejected because it hides normal child item/session/outcome structure.

## Test Plan

Required test coverage:

- contract fixtures for timed-media section data;
- session slice merge, replace, hydrate, persist, and round-trip tests;
- cue activation tests for reveal, pause-and-require-response, metadata, and multi-item cues;
- child item session propagation tests proving existing item sessions remain the source for responses;
- completion tests that separate media completion, cue completion, child item completion, and aggregate completion;
- score projection tests using the shared score/outcome contract;
- accessibility tests for keyboard controls, focus handoff, announcements, captions/transcripts, TTS/media handoff, and seek restrictions.

Commands:

```sh
bun run typecheck
bun run test
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

Playwright-backed tests must run outside the sandbox.

## Rollout And Release Notes

- Changeset required: yes, when public exports or player variants are added.
- Migration notes: additive section flavor; existing sections and layouts remain valid.
- Documentation updates: section-player docs, assessment-player renderer selection docs, timed-media demos, `pie-elements-ng` `video-stimulus` PRD, and `pie-qti` adapter PRDs.
- Release risk: high, because media playback, focus, completion, and score aggregation are user-visible and cross-package.

## Open Questions

- Which package owns the canonical timed-media section data types?
- Is media represented through rubric blocks, a new renderable flavor, or `timedMedia.media` only?
- Should `timedMedia` extend the existing section persistence snapshot or be normalized as a sibling slice by assessment-player?
- Which scoring policy defaults, if any, should PIE provide?
- What is the minimum timed-media MVP for cue timeline authoring, and which package owns that future PRD?
- What print/export behavior should timed-media sections have?
