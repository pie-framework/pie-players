# Media Asset Contract

Status: Ready. The media vocabulary in [Contract Shape](#contract-shape) is ratified as of 2026-08-09 and matches the shipped types in `@pie-players/pie-players-shared/types` field for field. The [Open Questions](#open-questions) that remain are policy questions — which fields a given consumer requires, whether duration is authoritative, whether rights metadata is in scope — and none of them changes a field name or a field position, so none of them blocks publication.

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

- Owning package: `@pie-players/pie-players-shared` (source at `packages/players-shared/src/types/index.ts`).
- Public export path: `@pie-players/pie-players-shared/types`, a subpath already in the package's `exports` map. The earlier `<owner>/media` candidate was not taken: the media types sit beside the catalog and section types that reference them, and a second subpath would split one vocabulary across two entry points.
- Consuming packages or apps: `assessment-toolkit` (sign-language and spoken-audio catalog cards, shared media validation), `section-player` (the per-item media region), timed-media section-player PRDs, `assessment-player`, `pie-elements-ng` `video-stimulus`, the `pie-api-aws` Learnosity importer as a producer, and `../pie-qti` adapters.
- Runtime environment: browser, Node-safe, custom element, and adapter-only.

The contract should stay data-only. Rendering APIs belong to element or player implementation PRDs.

## Contract Shape

These names are ratified. The block below mirrors `packages/players-shared/src/types/index.ts` field for field, including `MediaSource.bitrate`, which no consumer reads yet; it is kept because dropping it later is additive-compatible and adding it later to a published type is not.

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

`MediaFragmentRange` is carried **beside** the asset by whatever references it, never inside `MediaAssetRef` or `MediaSource`: a range describes one *use* of a recording, and the same recording is meant to serve several content nodes. `SignLanguageCardPayload.fragment` and `SpokenAudioCardPayload.fragment` hold it today; timed-media cue ranges take the same position.

The range carries no playback semantics, and consumers must not add any to it. The two shipped consumers read it as "play only this slice," and **the player enforces both bounds itself**: `applyMediaFragment` writes a Media Fragments URI, but that is a hint only — browsers honour the start offset inconsistently, so the signing region seeks explicitly on `loadedmetadata` (forward only, so it never fights a learner who already scrubbed), and they vary on the end bound, so it pauses on `timeupdate`. A timed-media cue would read the same shape as "the window in which this cue is active," which is not a slice to play at all. Each consumer states what its range means; nothing gets a `mode` discriminant and nothing forks the type.

Which fields are required is declared per consumer rather than at the type level — see [Second Carrier](#second-carrier-accessibility-catalog-cards). Which accessibility fields are required by policy rather than by schema stays open, and is a policy question that does not move a field.

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
- adapter round-trip fixtures once `../pie-qti` consumes this contract;
- accessibility review evidence for any runtime UI that consumes the contract.

What the two shipped consumers already cover, as of ratification: `sign-language-cards.test.ts` and `spoken-audio-cards.test.ts` exercise payload validation and the `content`-versus-`payload` rule, including rejection of an unsafe source scheme. `accessibility-catalog-card-forms.test.ts` covers something adjacent but distinct — form preference between a script card and a recording of it on the same node — not the payload shape. `section-item-media.test.ts` covers content discovery, strict sign-language matching and region sizing. Signing plays end to end in a browser under two specs, `section-player-sign-language-region.spec.ts` and `pie881-imported-asl-integration.spec.ts`, the second one on imported footage.

Five gaps follow, and they are the coverage a third consumer would otherwise discover:

- **`catalog-media.ts` has no direct test.** It is the shared validation layer — scheme allow-list, source normalization, dedupe by `src`, fragment normalization — reached only through its two callers, so a rule neither caller exercises is untested. It is also the security-relevant file of the set.
- **Multi-source payloads are untested.** Every fixture in both consumers carries a single source, so `normalizeMediaSources`' dedupe-by-`src` path and any encoding negotiation are unexercised. Dedupe is not cosmetic: a duplicate `src` would throw Svelte's duplicate-key error in the region's `{#each}` and take the region down rather than degrade.
- **`tracks` and `transcript` are untested, because neither shipped consumer uses them.** Meaningless for signing, unused for recorded audio, so the first real exercise is `video-stimulus`. Their shape is ratified on inspection, not on use.
- **`bitrate`, `thumbnail` and `durationSeconds` are unread by any consumer.**
- **`kind` validation is asymmetric.** `spoken-audio-cards.ts` rejects a card whose `media.kind` is not `"audio"` and reports why; `sign-language-cards.ts` does not check `kind` at all, so a card declaring `kind: "audio"` with a video URL renders in the signing region. Not a field change and not urgent — signing cards come from an importer that always writes `"video"` — but a third consumer should not read the shipped pair as a consistent precedent for how strictly to treat `kind`.

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

- Changeset required: yes. The exports exist and the next release publishes them.
- Migration notes: additive metadata contract; existing item and section models remain valid.
- Documentation updates: timed-media, video-stimulus, and QTI adapter PRDs should link to this contract.
- Release risk: medium, mainly around accessibility metadata and URL/privacy expectations.

**These types become public API at the next release.** They are reachable through the `@pie-players/pie-players-shared/types` subpath in the package's `exports` map, so the release that first publishes them converts every field above from a branch-local decision into an external surface. Revising one after that costs a breaking change to consumers outside this repo rather than an edit; the [ratification](#ratification-2026-08-09) is timed to that boundary for exactly this reason.

`MediaAssetRef.version: 1` is a required literal and gives a future revision somewhere to go, so the exposure is bounded rather than absent. It is not a reason to defer review: bumping to `2` obliges every consumer to accept both versions for as long as any producer emits `1`, and the `pie-api-aws` Learnosity importer is already a producer.

## Second Carrier: Accessibility Catalog Cards

Stimulus media is not the only media path. Accessibility catalogs carry media too — a `sign-language` catalog card is a video docked to a content node — and originally `CatalogCard` carried only a required `content` string, so such a card could only ever hold a bare URL: no multiple sources, no MIME types, no poster. (It could always name a `language`; what it could not express was the media itself.) PIE-880 made `content` optional and added the structured payload described below.

This contract is the payload for those cards rather than letting the catalog model grow a parallel set of media fields. **This half shipped ahead of the rest of the contract**: PIE-880 landed `MediaAssetRef`, `MediaSource`, `TextTrackRef`, `TranscriptRef` and `MediaFragmentRange` in `@pie-players/pie-players-shared/types`, with `CatalogCard.payload` as their first consumer — so the vocabulary a later timed-media consumer inherits is fixed in code, not merely proposed here. See [`../sign-language-asl-support.md`](../sign-language-asl-support.md).

Two catalog consumers ship, not one. `SpokenAudioCardPayload` — recorded audio as a `spoken` alternate — wraps a `MediaAssetRef` of `kind: "audio"` plus an optional range, in the same position `SignLanguageCardPayload` uses. That is the vocabulary's first independent test, and it passed without a field change: the same shape carried a second media kind and a second accommodation. It also produced the shared validation layer this contract implies but does not specify, `assessment-toolkit/src/services/catalog-media.ts` — source-scheme allow-list, source normalization, dedupe by `src`, fragment normalization — extracted when the second consumer arrived, because two copies of a URL allow-list is one copy that gets a security fix and one that does not. Any third consumer, `video-stimulus` included, uses it rather than validating authored URLs again.

Two consequences for this contract:

- `MediaAssetRef` must be usable for a short, single-purpose clip, not only for a section-scale stimulus. Resolve that by having each **consumer declare its required subset**, not by making every field optional at the type level — a type where nothing is required stops catching anything. For signing: sources and language required, poster and duration not applicable, and `tracks`/`transcript` actively meaningless, since captions on a signing video would be the English text already on screen.
- Catalog cards need a **time range within** an asset, because QTI 3 expresses signing time slices with Media Fragments URIs so one recording can serve several content nodes. Timed media needs the same primitive for cue ranges. Design it once, now — see the sequencing note below.

### Sequencing: Two Concurrent Consumers

Updated 2026-08-07. Timed media and sign-language support are both expected to start soon, possibly in parallel. That changes this contract's position: it is no longer a contract with one prospective consumer but a **blocker for two concurrent ones**.

Two implications. Design `MediaAssetRef` against both consumers from the start rather than letting whichever moves first shape it and the other adapt — a contract with two concrete consumers gets designed better than one designed in the abstract, but only if both are at the table. And land it before either side writes media-handling code, or the result is two media vocabularies and a merge later.

This promotes `media-asset-contract` from third in the [shared-contracts review sequence](./README.md) to first.

**The second instruction was not followed, and this ratification is the recovery.** Signing wrote media-handling code first and the contract trailed it. The intended failure did not occur — the vocabulary was designed against both consumers even though only one exercised it, and the [ratification check](#ratification-2026-08-09) below found nothing the timed-media side needs changed. Recorded because the near miss was luck-adjacent: the same sequence with a less careful first consumer produces the two-vocabularies outcome this section warned about. The remaining exposure is narrower and real — see the release note in [Rollout And Release Notes](#rollout-and-release-notes).

### Ratification, 2026-08-09

Ratified against the timed-media consumer before the release that first publishes these types, which is the last point at which a change is free. The timed-media side is still unbuilt, so its input came from its own proposed shapes: `VideoStimulusModel` and `timedMedia.media` in [`../../architecture/timed-media-section.md`](../../architecture/timed-media-section.md), and the `cues[].startTime` sketch beside them.

Two questions, both settled without a field change:

- **Does a cue range fit `MediaFragmentRange`?** Yes, in both cue forms the architecture note describes. A point cue is `{ startSeconds }` with the end omitted; a ranged cue carries both. The note's `startTime` becomes `startSeconds`, a rename inside an unratified proposal and therefore free. The position is also right for cues without argument: a cue references the section's shared stimulus and the range describes that cue's use of it, which is exactly the beside-the-asset rule the signing consumer established. What differs is meaning, not shape, and [Contract Shape](#contract-shape) now says the type carries no playback semantics so both readings stay legitimate.
- **Does a stimulus need anything `MediaAssetRef` lacks?** No. Every field of the proposed `VideoStimulusModel` maps onto a shipped one — `sources`, `poster`, `captions` onto the wider `tracks`, `transcript`, and `accessibilityLabel` onto `label`/`description`. `MediaKind` was already `image | audio | video | other` rather than video-shaped, which the spoken-audio consumer has now exercised. `VideoStimulusModel.element` does not map and should not: a versioned PIE tag name belongs to the element model, not to media metadata.

So `video-stimulus` inherits this vocabulary rather than extending it, and the timed-media section contract's remaining media work is to name what its cue ranges *mean*, not to define how a range is spelled.

## Open Questions

None of these moves a field or a field position, which is why they do not hold up publication.

- Which media fields are schema-required versus policy-required, per consumer. Signing and spoken audio have each declared their subset in code; `video-stimulus` will declare its own, and captions/transcript are the fields most likely to be policy-required there rather than schema-required.
- Should duration be authoritative, advisory, or always derived by runtime media loading when possible? Both shipped consumers ignore `durationSeconds` and read duration off the media element, which is evidence for advisory but not a decision.
- Does rights/license metadata belong in this contract or host-only metadata?

Three questions are answered and recorded rather than left open. The first two were settled by the shipped signing consumer (2026-08-08):

- **Where a time range lives.** Not in `MediaSource` and not in `MediaAssetRef`: a range is a property of *this use* of an asset, not of the asset or of one encoding of it, and the same recording is meant to serve several content nodes. It is a separate `MediaFragmentRange { startSeconds, endSeconds? }` carried beside the asset by whatever references it — `SignLanguageCardPayload.fragment` today. Timed-media cue ranges should reuse the type in the same position rather than nesting it inside the asset. Corrected 2026-08-09 against the shipped region: the Media Fragments URI is written but treated as a hint for *both* bounds, not just the end. Browsers honour the start offset inconsistently too, so the player seeks explicitly once metadata loads and pauses on `timeupdate` at the end — an earlier reading of this line credited the URI with the start offset.
- **Whether `MediaAssetRef` is the signing card payload.** Yes — `SignLanguageCardPayload` wraps it rather than restating media fields, and the required subset is declared per consumer as described above.

And the third by the shipped shape itself:

- **Which transcript forms are allowed.** All three. `TranscriptRef` carries `src`, `html` and `plainText` as independent optional fields, because the three serve different callers — an external reference for a host-hosted transcript, inline HTML for authored markup, plain text for adapters and non-visual consumers — and a union would force a caller holding two of them to drop one. No precedence rule between them is defined here; a consumer rendering a transcript picks and documents its own.
