# Media Asset Contract

Status: Accepted, 2026-08-09

Owner: PIE Players maintainers

Related architecture:

- [P0 shared contracts](../../architecture/shared-contracts-p0.md)
- [Timed media section architecture](../../architecture/timed-media-section.md)
- [Sign language (ASL) support](../sign-language-asl-support.md)

Integrator guide: [Media Validation](../../../packages/players-shared/README.md#media-validation) in the players-shared README.

## Problem

Before this contract, timed media, audio and video stimulus work, and standards adapters had no shared vocabulary for stimulus media, so element models, section profiles and QTI mappings would each have invented media fields, with lossy transforms and inconsistent accessibility requirements between them.

The contract carries enough media metadata to render accessible stimulus media and coordinate section behavior, without making PIE a media repository or asset-management platform.

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

- Owning package: `@pie-players/pie-players-shared` (types in `packages/players-shared/src/types/index.ts`, validation helpers in `packages/players-shared/src/media/index.ts`).
- Public export path: `@pie-players/pie-players-shared/types` for the types, beside the catalog and section types that reference them, since a second subpath would split one vocabulary across two entry points. `@pie-players/pie-players-shared/media` exports the validation and fragment helpers and no types, and runs nothing at import time, so a tool or element validates authored media without importing the toolkit.
- Consuming packages: `assessment-toolkit` (spoken-audio catalog cards, which the TTS service plays), `tool-sign-language` (sign-language catalog cards), `players-shared/timed-media` (cue ranges) and `section-player` (the per-item media region). In pie-elements-ng, `video-stimulus` reads the vocabulary through a mirror in `@pie-element/shared-types`, because elements take no player-package dependency. The PIE API service's Learnosity importer writes sign-language cards in it. QTI adapters in [pie-qti](https://github.com/pie-framework/pie-qti) do not consume it yet.
- Runtime environment: browser, Node-safe, custom element, and adapter-only.

The contract stays data-only. Rendering APIs belong to element or player implementation PRDs.

## Contract Shape

The block below mirrors `packages/players-shared/src/types/index.ts` field for field, including `MediaSource.bitrate`, which no player or element rendering code reads; removing a field from the published type would be a breaking change.

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

interface MediaFragmentRange {
  startSeconds: number;
  endSeconds?: number;
}
```

`TranscriptRef` carries `src`, `html` and `plainText` as independent optional fields, because the three serve different callers — an external reference for a host-hosted transcript, inline HTML for authored markup, plain text for adapters and non-visual consumers — and a union would force a caller holding two of them to drop one. No precedence rule between them is defined here; a consumer rendering a transcript picks and documents its own.

`MediaFragmentRange` is carried **beside** the asset by whatever references it, never inside `MediaAssetRef` or `MediaSource`: a range describes one *use* of a recording, and the same recording is meant to serve several content nodes. `SignLanguageCardPayload.fragment`, `SpokenAudioCardPayload.fragment` and timed-media cue ranges all hold it in that position.

The range carries no playback semantics, and consumers must not add any to it; each consumer states what its range means. The two catalog-card consumers read it as "play only this slice" and enforce both bounds through `enforceMediaFragment`, because browsers honor neither bound of the Media Fragments URI that `applyMediaFragment` writes reliably. It seeks forward to the start once metadata loads and checks the end on `timeupdate` and a 100 ms poll; the caller picks the end action, so the signing region pauses and recorded TTS audio ends the clip so the next chunk plays. A timed-media cue reads the same shape as the window in which the cue is active, which is not a slice to play. Nothing gets a `mode` discriminant and nothing forks the type.

Which fields are required is declared per consumer rather than at the type level — see [Catalog-Card Carriers](#catalog-card-carriers). Which accessibility fields are required by policy rather than by schema stays open, and is a policy question that does not move a field.

## Compatibility

This PRD introduces additive media metadata. It must not change PIE element runtime contracts, item-player APIs, or section session behavior by itself.

If a media reference points to a PIE element, the surrounding source reference must preserve the full versioned tag name and contract identifiers unchanged.

No generic media metadata bag should be added to section sessions. Timed-media state needs a named typed slice owned by its PRD.

## Data Ownership And Host Responsibilities

PIE owns:

- media metadata vocabulary;
- data-shape validation, exported from `@pie-players/pie-players-shared/media`;
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

URLs are opaque host-owned references. PIE infers no authorization or retention semantics from URL shape.

`MediaAssetRef.version: 1` is a required literal, so a future revision has somewhere to go. Bumping it to `2` obliges every consumer to accept both versions for as long as any producer emits `1`, and the PIE API service's Learnosity importer already emits `1`.

## Accessibility

The contract supports:

- captions and subtitles, preferably WebVTT for browser playback;
- transcript references or inline transcript text;
- accessible label and description fields;
- language metadata on assets and tracks;
- poster/thumbnail metadata that does not replace text alternatives;
- non-video alternatives where video itself is not an accessible source.

Player and element PRDs must define when captions/transcripts are required by policy and how the UI exposes them.

## Standards Or Adapter Impact

This contract provides adapter-friendly data for QTI/PCI, xAPI, and Caliper media statements. It does not claim conformance.

QTI media/stimulus mapping belongs in [pie-qti](https://github.com/pie-framework/pie-qti). The QTI adapter must document any lossy mapping from this media contract into QTI media or package constructs.

## Catalog-Card Carriers

Accessibility catalogs carry media too: a `sign-language` catalog card is a video docked to a content node. `CatalogCard` originally carried only a required `content` string, so such a card could hold only a bare URL, with no second source, MIME type or poster. `content` is now optional, and the structured `CatalogCard.payload` is this contract, so the catalog model grows no parallel set of media fields. `SignLanguageCardPayload` wraps a `MediaAssetRef` rather than restating media fields, and `SpokenAudioCardPayload`, recorded audio as a `spoken` alternate, wraps a `MediaAssetRef` of `kind: "audio"`; both carry the optional range as `fragment`. The second payload carried a second media kind and a second accommodation without a field change. See [`../sign-language-asl-support.md`](../sign-language-asl-support.md).

The shared validation layer, now `@pie-players/pie-players-shared/media`, was extracted when the second consumer arrived, because two copies of a URL allow-list drift apart on security fixes. Every pie-players consumer validates authored media through it. `video-stimulus` keeps a copy of `isSafeMediaSrc` and `normalizeMediaSources` in pie-elements-ng, held to parity by its tests, so a rule change lands in both repositories.

Two rules bind every consumer:

- Each **consumer declares its required subset**; the type does not make every field optional, since a type where nothing is required stops catching anything. For signing: sources and language required, poster and duration not applicable, and `tracks`/`transcript` actively meaningless, since captions on a signing video would be the English text already on screen.
- A **time range within** an asset is part of the vocabulary, because QTI 3 expresses signing time slices with Media Fragments URIs so one recording can serve several content nodes, and timed media needs the same primitive for cue ranges.

## Ratification

Ratified 2026-08-09 against the timed-media consumer's proposed shapes, `VideoStimulusModel` and `timedMedia.media` in [`../../architecture/timed-media-section.md`](../../architecture/timed-media-section.md), before the first release that published the types; from that release on, revising a field is a breaking change for consumers outside this repo. Signing had landed its media code first, so the check confirmed a vocabulary already in code. It found no field change:

- **A cue range fits `MediaFragmentRange`** in both cue forms: a point cue is `{ startSeconds }` with the end omitted, and a ranged cue carries both. A cue references the section's shared stimulus and its range describes that cue's use of it, the same beside-the-asset position the card payloads use.
- **A stimulus needs nothing `MediaAssetRef` lacks.** Every field of the proposed `VideoStimulusModel` maps onto a shipped one: `sources`, `poster`, `captions` onto the wider `tracks`, `transcript`, and `accessibilityLabel` onto `label`/`description`. `VideoStimulusModel.element` does not map and should not: a versioned PIE tag name belongs to the element model, not to media metadata.

So `video-stimulus` inherits this vocabulary rather than extending it, and the [timed-media section contract](../timed-media-section-contract.md) states what its cue ranges mean.

## Test Plan

Required test coverage:

- schema fixtures for each media kind;
- fixtures for multiple sources with MIME types;
- captions/subtitles/transcript fixtures;
- validation tests for required fields per media kind;
- adapter round-trip fixtures once [pie-qti](https://github.com/pie-framework/pie-qti) consumes this contract;
- accessibility review evidence for any runtime UI that consumes the contract.

What the shipped consumers cover: `sign-language-cards.test.ts` and `spoken-audio-cards.test.ts` exercise payload validation and the `content`-versus-`payload` rule, including rejection of an unsafe source scheme, and the sign-language tests resolve a multi-source card in authored order. `tts-recorded-audio.test.ts` covers fragment application and the start seek for recorded audio. `accessibility-catalog-card-forms.test.ts` covers something adjacent but distinct — form preference between a script card and a recording of it on the same node — not the payload shape. `sign-language-content.test.ts` covers owner-snapshot discovery and strict sign-language matching; `card-media-region.test.ts` covers the host's region sizing, while `tool-surface-host.test.ts` covers the shared surface lifecycle. Signing plays end to end in a browser under two specs, `section-player-sign-language-region.spec.ts` and `pie881-imported-asl-integration.spec.ts`, the second one on imported footage.

Coverage gaps:

- **`@pie-players/pie-players-shared/media` has no direct test of its validators.** Its one test file covers `applyMediaFragment`. The scheme allow-list, source normalization, dedupe by `src` and fragment normalization are reached only through their callers: the two card validators and the timed-media cue validation, which uses only fragment normalization. A rule none of them exercises is untested, and this is the security-relevant file of the set.
- **Source dedupe is untested.** No test fixture repeats a `src`, so the dedupe path of `normalizeMediaSources` is unexercised. The signing region keys its `{#each}` by `src`, so a duplicate would throw Svelte's duplicate-key error and take the region down.
- **`tracks` and `transcript` have no consumer or test in this repo.** They are meaningless for signing and unused for recorded audio. `video-stimulus` reads both in pie-elements-ng through its mirrored types; here their shape is ratified on inspection.
- **No player or element rendering code reads `bitrate`, `thumbnail` or `durationSeconds`.**
- **`kind` validation is asymmetric.** `spoken-audio-cards.ts` rejects a card whose `media.kind` is not `"audio"` and reports why; `sign-language-cards.ts` does not check `kind`, so a card declaring `kind: "audio"` with a video URL renders in the signing region. Signing cards come from an importer that always writes `"video"`, so nothing live hits it, but a new consumer should not take the pair as precedent for how strictly to check `kind`.

Commands:

```sh
bun run typecheck
bun run test
```

For custom-element or export-boundary changes, also run the [high-value checks](../../../AGENTS.md#high-value-checks). Playwright-backed tests run outside the sandbox; see [Playwright and sandboxed execution](../../../AGENTS.md#playwright-and-sandboxed-execution).

## Rollout And Release Notes

- Changeset required: yes. The types first published in `@pie-players/pie-players-shared` 0.3.64.
- Migration notes: additive metadata contract; existing item and section models remain valid.
- Documentation updates: the timed-media, sign-language and audio-accommodations PRDs and the players-shared README link this contract.
- Release risk: medium, mainly around accessibility metadata and URL/privacy expectations.

## Open Questions

None of these moves a field or a field position.

- Which media fields are schema-required versus policy-required, per consumer. Signing and spoken audio declare their subsets in code; captions and transcript are the fields most likely to be policy-required for stimulus video rather than schema-required.
- Should duration be authoritative, advisory, or always derived by runtime media loading when possible? Both card consumers ignore `durationSeconds` and read duration off the media element, which is evidence for advisory but not a decision.
- Does rights/license metadata belong in this contract or host-only metadata?
