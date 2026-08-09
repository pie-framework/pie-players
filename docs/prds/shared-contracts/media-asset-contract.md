# Media Asset Contract

Status: Draft

Owner: PIE Players maintainers

Related architecture:

- [P0 shared contracts](../../architecture/shared-contracts-p0.md)
- [Timed media section architecture](../../architecture/timed-media-section.md)
- [Sign language (ASL) support](../sign-language-asl-support.md)

## Problem

Timed-media assessment, future audio/video stimulus work, and standards adapters need a shared vocabulary for stimulus media. Today media fields would likely be invented separately by element models, section profiles, and QTI mappings, which risks lossy transforms and inconsistent accessibility requirements.

PIE needs enough media metadata to render accessible stimulus media and coordinate section behavior without becoming a media repository or asset-management platform.

## Goals

- Define a media asset reference shape for stimulus media used by players, elements, and adapters.
- Support images, audio, video, and future media kinds without hard-coding a video-only contract.
- Make captions, subtitles, transcripts, language, labels, poster/thumbnail, MIME type, and duration explicit.
- Keep storage, signed URLs, CDN, authorization, privacy, and transcoding host-owned.
- Provide a contract that `pie-elements-ng` `video-stimulus` and timed-media section PRDs can consume.

## Non-Goals

- No upload, storage, media library, transcoding, virus scanning, retention, or signed-URL service.
- No browser player dependency choice is ratified by this contract.
- No cue-to-item binding or playback policy; those belong to timed-media section contracts.
- No learner-submitted evidence contract; evidence metadata is separate because ownership and privacy differ.
- No standards conformance claim for QTI media, WebVTT, LTI, xAPI, or Caliper.

## Package And Export Ownership

- Owning package: proposed `@pie-players/pie-players-shared`.
- Public export path: open question; candidate shape is `<owner>/media`.
- Consuming packages or apps: timed-media section-player PRDs, `assessment-toolkit`, `section-player`, `assessment-player`, `pie-elements-ng` `video-stimulus`, sign-language catalog cards, and `../pie-qti` adapters.
- Runtime environment: browser, Node-safe, custom element, and adapter-only.

The contract should stay data-only. Rendering APIs belong to element or player implementation PRDs.

## Contract Shape

The final names are not ratified by this draft. The contract should represent a referenced media asset and its accessible alternates.

Documentation sketch only:

```ts
type MediaKind = "image" | "audio" | "video" | "other";

interface MediaSource {
  src: string;
  type?: string;
  width?: number;
  height?: number;
  bitrate?: number;
}

interface TextTrackRef {
  src: string;
  kind: "captions" | "subtitles" | "descriptions" | "chapters" | "metadata";
  lang: string;
  label: string;
  default?: boolean;
}

interface TranscriptRef {
  src?: string;
  html?: string;
  plainText?: string;
  lang?: string;
}

interface MediaAssetRef {
  version: 1;
  id: string;
  kind: MediaKind;
  sources: MediaSource[];
  poster?: string;
  thumbnail?: string;
  durationSeconds?: number;
  tracks?: TextTrackRef[];
  transcript?: TranscriptRef;
  label?: string;
  description?: string;
  lang?: string;
}
```

The accepted contract should state which fields are required for each media kind and which accessibility fields are required by policy rather than by schema.

## Compatibility

This PRD introduces additive media metadata. It must not change PIE element runtime contracts, item-player APIs, or section session behavior by itself.

If a media reference points to a PIE element, the surrounding source reference must preserve the full versioned tag name and contract identifiers unchanged.

No generic media metadata bag should be added to section sessions. Timed-media state needs a named typed slice owned by its PRD.

## Data Ownership And Host Responsibilities

PIE owns:

- media metadata vocabulary;
- validation for data shape if exported publicly;
- accessibility expectations that player/element PRDs consume.

Hosts own:

- asset storage and retrieval;
- signed URLs and authorization;
- CDN, CSP, availability, and caching policy;
- malware scanning;
- privacy, consent, retention, and deletion;
- transcoding and alternate renditions;
- rights management and license metadata unless a future PRD explicitly scopes it.

## Serialization And Versioning

Media asset references are persisted or wire-facing data and require:

- `version: 1`;
- validation by the owning package;
- unknown-field preservation only where a host or adapter explicitly owns those fields;
- unknown-version rejection for runtime rendering;
- fixtures for image, audio, video, captions, subtitles, transcripts, poster, and missing-duration cases.

URLs should be treated as opaque host-owned references. PIE should not infer authorization or retention semantics from URL shape.

## Accessibility

The contract should support:

- captions and subtitles, preferably WebVTT for browser playback;
- transcript references or inline transcript text;
- accessible label and description fields;
- language metadata on assets and tracks;
- poster/thumbnail metadata that does not replace text alternatives;
- non-video alternatives where video itself is not an accessible source.

Player and element PRDs must define when captions/transcripts are required by policy and how the UI exposes them.

## Standards Or Adapter Impact

This contract should provide adapter-friendly data for QTI/PCI, xAPI, and Caliper media statements. It does not claim conformance.

QTI media/stimulus mapping belongs in `../pie-qti`. The QTI adapter must document any lossy mapping from this media contract into QTI media or package constructs.

## Test Plan

Required test coverage:

- schema fixtures for each media kind;
- fixtures for multiple sources with MIME types;
- captions/subtitles/transcript fixtures;
- validation tests for required fields per media kind;
- adapter round-trip fixtures once `../pie-qti` consumes the accepted contract;
- accessibility review evidence for any runtime UI that consumes the contract.

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
- Migration notes: additive metadata contract; existing item and section models remain valid.
- Documentation updates: timed-media, video-stimulus, and QTI adapter PRDs should link to the accepted contract.
- Release risk: medium, mainly around accessibility metadata and URL/privacy expectations.

## Second Carrier: Accessibility Catalog Cards

Stimulus media is not the only media path. Accessibility catalogs carry media too — a `sign-language` catalog card is a video docked to a content node — and originally `CatalogCard` carried only a required `content` string, so such a card could only ever hold a bare URL: no multiple sources, no MIME types, no poster. (It could always name a `language`; what it could not express was the media itself.) PIE-880 made `content` optional and added the structured payload described below.

This contract should be the payload for those cards rather than letting the catalog model grow a parallel set of media fields. **This half has shipped ahead of the rest of the contract**: PIE-880 landed `MediaAssetRef`, `MediaSource`, `TextTrackRef`, `TranscriptRef` and `MediaFragmentRange` in `@pie-players/pie-players-shared/types`, with `CatalogCard.payload` as their first consumer — so the vocabulary a later timed-media consumer inherits is already fixed in code, not merely proposed here. See [`../sign-language-asl-support.md`](../sign-language-asl-support.md).

Two consequences for this contract:

- `MediaAssetRef` must be usable for a short, single-purpose clip, not only for a section-scale stimulus. Resolve that by having each **consumer declare its required subset**, not by making every field optional at the type level — a type where nothing is required stops catching anything. For signing: sources and language required, poster and duration not applicable, and `tracks`/`transcript` actively meaningless, since captions on a signing video would be the English text already on screen.
- Catalog cards need a **time range within** an asset, because QTI 3 expresses signing time slices with Media Fragments URIs so one recording can serve several content nodes. Timed media needs the same primitive for cue ranges. Design it once, now — see the sequencing note below.

### Sequencing: Two Concurrent Consumers

Updated 2026-08-07. Timed media and sign-language support are both expected to start soon, possibly in parallel. That changes this contract's position: it is no longer a contract with one prospective consumer but a **blocker for two concurrent ones**.

Two implications. Design `MediaAssetRef` against both consumers from the start rather than letting whichever moves first shape it and the other adapt — a contract with two concrete consumers gets designed better than one designed in the abstract, but only if both are at the table. And land it before either side writes media-handling code, or the result is two media vocabularies and a merge later.

This promotes `media-asset-contract` from third in the [shared-contracts review sequence](./README.md) to first.

## Open Questions

- Which media fields are schema-required versus policy-required?
- Should transcript support allow inline HTML, plain text, external references, or all three?
- Should duration be authoritative, advisory, or always derived by runtime media loading when possible?
- Does rights/license metadata belong in this contract or host-only metadata?

Two questions here were answered by the shipped signing consumer (2026-08-08), and are recorded rather than left open:

- **Where a time range lives.** Not in `MediaSource` and not in `MediaAssetRef`: a range is a property of *this use* of an asset, not of the asset or of one encoding of it, and the same recording is meant to serve several content nodes. It is a separate `MediaFragmentRange { startSeconds, endSeconds? }` carried beside the asset by whatever references it — `SignLanguageCardPayload.fragment` today. Timed-media cue ranges should reuse the type in the same position rather than nesting it inside the asset. Browsers honour the start offset when it is applied as a Media Fragments URI; the end offset is enforced by the player, because support for the end bound is inconsistent.
- **Whether `MediaAssetRef` is the signing card payload.** Yes — `SignLanguageCardPayload` wraps it rather than restating media fields, and the required subset is declared per consumer as described above.
