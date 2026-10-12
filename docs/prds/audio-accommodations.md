# Audio Accommodations: Transcript And Autoplay Control

Status: Accepted, 2026-08-15

Implementation status: the transcript contract shipped in pie-players, for
section delivery and for print. Autoplay control remains a proposal; see
[Open Questions](#open-questions). Outstanding in pie-elements-ng: the
`mc-populated-blank` print build still renders the legacy `audioTranscript`
model field, which imported content still carries, so an item with both that
field and a `transcript` card prints two transcripts wherever the card is in
play.

Owner: PIE Players maintainers

This PRD defines how PIE Players delivers the transcript of a recorded audio
prompt as a policy-gated accessibility catalog card, and records the open
question of where autoplay control belongs. It is for maintainers of the
accessibility pipeline and for content producers that emit transcript cards.

Related architecture:

- [What Counts As A Tool](../tools-and-accomodations/architecture.md#what-counts-as-a-tool) — the eligibility / content-dependency / placement split this PRD applies to audio
- [Sign Language (ASL) Support](./sign-language-asl-support.md) — the same three-part shape; this PRD is its second instance
- [Accessibility Catalogs Integration Guide](../accessibility/accessibility-catalogs-integration-guide.md)
- [Accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md)
- [Media asset contract](./shared-contracts/media-asset-contract.md) — for the recorded-audio card form
- [ADR 0003](../adr/0003-elements-read-accessibility-settings-from-a-host-neutral-context.md) — the host-neutral accessibility context an element can read without importing the toolkit

Integrator guide: [Content-dependent capabilities](../../packages/default-tool-loaders/README.md#content-dependent-capabilities)
in the default tool loaders README for packaging,
[Content-card tool surfaces](../../packages/section-player/README.md#content-card-tool-surfaces)
in the section player README for rendering, and
[Accessibility Alternates](../../packages/print-player/README.md#accessibility-alternates)
in the print player README for print.

## Problem

Assessments for pre-readers deliver prompts as recorded audio with no on-screen
text. Some states hold that WCAG's audio-transcript requirement applies, so
affected items carried an `audio_transcript` property that had to appear before
the audio player, but only for students identified as needing it. Universal
display breaks three item families: audio-only items for pre-readers,
letter-sound items ("which letter makes the /s/ sound"), and
listening-comprehension items, where showing the passage as text changes the
construct being measured.

The first implementation predated the toolkit's accommodation machinery.
`mc-populated-blank` in pie-elements-ng rendered `model.audioTranscript` into the
DOM unconditionally and decided only its visibility, from a class the host
placed on an ancestor, watched with a `MutationObserver` over every ancestor's
`class` attribute. That had four costs:

1. **The decision was invisible to policy.** No support id was consulted, so
   district, test-administration and item-level precedence could not reach it,
   and the PNP debugger could not show it.
2. **Every element with audio had to reimplement it.** The class check, the
   observer and the `sr-only` copy were per-element code.
3. **The model flag was dead.** The controller computed `showVisibleTranscript`,
   and delivery shadowed it with the class check.
4. **The gate was visual only.** An unrevealed transcript stayed in the DOM as
   `sr-only`, wired into `aria-describedby`, so assistive technology read it
   regardless of the accommodation. For a listening-comprehension item that is
   the construct the gate exists to protect.

The class is not carried forward, because a DOM class as an accommodation
channel does not fit the catalog model and keeping it would leave two sources of
truth for one decision. Affected items are migrated by a backend content
transform into catalog cards, as imported signed video was. The runtime knows
neither the legacy shape nor the transform.

## Goals

- Represent an audio transcript as an accessibility catalog card, resolved and
  gated the way every other alternate representation is.
- Give the transcript a policy identity, so eligibility resolves through the
  existing PNP precedence and appears in the PNP debugger.
- Require no element awareness of accommodations. Elements do not read policy,
  check classes, or decide who sees a transcript.
- Define the card a content producer emits.
- Settle whether autoplay needs a policy identity, or is a content property set
  at import.

## Non-Goals

- No support for the legacy ancestor class and no compatibility shim for it.
- No force-listen gate (blocking answer or advance until playback completes).
  That is progression control, and it belongs to section-player alongside
  timed-media gating.
- No new audio player element, and no change to how an element renders its own
  audio control. [Audio Prompts As Catalog Cards](#audio-prompts-as-catalog-cards)
  records the deferred direction that would change that.

## Package And Export Ownership

- Owning packages: `@pie-players/pie-assessment-toolkit` for the support id, the
  decision API and the grant-AND-content rule;
  `@pie-players/pie-default-tool-loaders` for the transcript capability
  (`audioTranscriptRegistration`); `@pie-players/pie-section-player` and
  `@pie-players/pie-print-player` for rendering it into their own surfaces.
- Public export paths: `resolveContentCapabilities` on the toolkit's
  `tools/registration` entry; `AccessibilityCatalogResolver` on the
  `services/AccessibilityCatalogResolver` subpath, so print reaches it without
  bundling the toolkit root; `accessibility` on `<pie-print>`'s config.
- Consuming packages: section-player, print-player and the PNP debugger.
  pie-elements-ng takes no toolkit dependency.
- Runtime environment: browser.
- Content production: the content transform in the PIE API backend
  (`pie-api-aws`) emits transcript cards for imported items. Nothing in PIE
  assumes it ran.

## Contract Shape

A transcript is a string alternate: a `CatalogCard` with `content` and an
optional `visibility`.

```json
{
  "identifier": "q1-transcript",
  "cards": [
    {
      "catalog": "transcript",
      "language": "en-US",
      "visibility": "onGrant",
      "content": "The word is look. Pick the correct spelling of the word look."
    }
  ]
}
```

- **Support id and catalog type.** `transcript` is the AfA support id that gates
  the accommodation and the catalog type that carries the text.
- **`visibility` is the discriminant.** `"always"` is authored presentation: the
  item family was designed to be delivered with its transcript on screen, so no
  profile grants it and none revokes it. Any other value, `"onGrant"` or absent
  included, is the accommodation, decided against the `transcript` support id,
  and a silent profile means no. An `"always"` card wins over an accommodation
  card on the same owner.
- **Text.** A card whose `content` is empty or whitespace is not a transcript and
  renders nothing.
- **Language.** The capability does no language negotiation, since a transcript
  is in the language of the audio it transcribes, one per prompt. The card's
  `language` is written to the rendered region's `lang` attribute unchanged, so
  it must be a BCP 47 tag (`es-ES`); a POSIX `es_ES` produces an invalid `lang`.
- **Identifier.** The catalog identifier is opaque to PIE and round-trips byte
  for byte. The transform's convention is `${modelId}-transcript`, deterministic
  so a re-run recognizes its own output.

`transcript` is never granted by default: a transcript shown to a student who
did not need it can invalidate a listening-comprehension item. It stays out of
the universal preset (`createUniversalPersonalNeedsProfile()`), as every
content-dependent support does. The registration declares
`requiresAuthoredContent`, which is both the render gate (no card, nothing to
show) and the declaration a host filters on when it builds its own grant list,
and `resolvesWithoutGrant`, because authored presentation has to be read when
policy granted nothing:

```ts
requiresAuthoredContent: {
  resolve(context: ToolContentDependencyContext) {
    return resolveAudioTranscript(context);
  },
  description:
    "An accessibility catalog card of type `transcript` on the item or passage",
},
resolvesWithoutGrant: true,
```

### Owner-Scope Resolution

The card resolves by owner scope, and `data-catalog-idref` docking is optional
and usually impossible. An audio prompt is a model field (`audioUrl`), not
authored markup, so the audio-only items that need transcripts most have no
author-written node to dock to. The toolkit's tool-surface host hands every
content capability, signing included, the owner snapshot from
`AccessibilityCatalogResolver.forOwner(...)`, with entity-root,
extractor-generated and model-owned catalogs already ordered by precedence. The
transcript capability reads that snapshot directly and takes the first
`transcript` card with text. It bypasses `getAlternative`, which flattens a card
to type, language and content and so drops `visibility`.

## Rendering On The Content-Lead Surface

Elements render content and the player owns accommodations, so the transcript
renders into a card surface the capability fills. `CONTENT_LEAD_SURFACE`
(`"content-lead"`, marked `data-pie-tool-surface="content-lead"`) is full width,
above the card body, in document flow. It is separate from
`CONTENT_MEDIA_SURFACE` because the geometry differs: docked media is watched
beside the content and sized by an aspect ratio, while a text alternate is read
before the control it belongs to. Item cards and passage cards both open it, so
reading order is header, transcript, audio prompt on either, and the capability
reaches both without knowing which card it is in.

pie-elements-ng has no toolkit dependency, and the boundary is deliberate. [ADR
0003](../adr/0003-elements-read-accessibility-settings-from-a-host-neutral-context.md)
defines the host-neutral context through which an element can learn the supports
in effect without importing the toolkit; the transcript does not use it.

The placement meets the requirement that text appears before the audio player in
reading order, at item granularity. Immediate adjacency to the audio control is
an open question.

The `visibility` split is why the registration ships in the packaged set while
signing does not: an item authored to show its transcript must show it in every
player, and a deployment that forgot an import would deliver a designed-for
reading support as nothing. The accommodation half is policy-gated exactly as
signing is.

The rendered region is a `section` with `role="region"` and a labeled accessible
name (the `tools.audioTranscript.regionA11y` string, "Transcript" in English).
It carries `data-transcript-visibility` (`always` or `onGrant`) for the PNP
debugger and for themes. It has no `aria-describedby` back to the element's
audio control, because a description is announced as a flat string on focus,
which is worse to listen to than reading order for multi-sentence text.

### Print

`@pie-players/pie-print-player` resolves accessibility catalogs itself, against
the profile passed as `config.accessibility`, with the same policy engine,
catalog resolver and `resolveContentCapabilities` that delivery uses. It asks
once, since a print job is one learner with one profile and nothing to toggle.
Print opens only the `content-lead` surface. An alternate in play prints inline
and unconditionally, with its accessible name rendered as a visible label. The
element's own print copy of `model.audioTranscript` is therefore redundant.

### Audio Prompts As Catalog Cards

A deferred direction. An audio prompt is itself alternate-representation-shaped.
`spoken` carries a recorded-audio payload (see
[Recorded Audio as a Spoken Alternate](../accessibility/accessibility-catalogs-integration-guide.md#recorded-audio-as-a-spoken-alternate)),
so one docking node can carry three cards: `spoken` (recorded audio),
`transcript` (text) and `sign-language` (video), each gated by its own support
id and all rendered by the player, with elements owning no accommodation media.
Autoplay becomes a player concern at the same point, which gives an app-level
override somewhere to live.

The cost is that pre-reader layout moves into the player: `mc-populated-blank`
places its Listen button inside the item layout (`layoutProfile:
'audio_blank_only'`, feature-button skins, inline sentence audio). That is a
content and UX program. Nothing in this PRD adds element coupling, so the
direction stays open.

## Compatibility

This PRD touches:

- **PIE element contracts.** `mc-populated-blank` lost the ancestor class check,
  the `MutationObserver`, the `sr-only` transcript node with its
  `aria-describedby`, and `showVisibleTranscript`. Its print build still reads
  `audioTranscript`.
- **Authored data.** Affected items change shape by transform in the content
  pipeline. No schema changes.
- **Contract attributes.** Adds the `content-lead` card surface on item and
  passage cards. The legacy ancestor class means nothing to PIE; hosts may keep
  writing it.

It must not change versioned `pie-*` tag names, `pie-item-player`
properties/events/methods, section completion state, or assessment-player
routing.

## Data Ownership And Host Responsibilities

PIE owns: the support-id vocabulary, precedence evaluation, catalog resolution,
the transcript region and its accessible wiring.

Hosts own: which students have the accommodation, transcript text and audio
assets, and the program-level decision about autoplay.

## Serialization And Versioning

No new persisted or wire-facing types. The transcript card is a `CatalogCard`;
removing two model fields is a content-pipeline migration, with no schema
version bump.

## Accessibility

- The accommodation is gated by the student's profile, at the right precedence,
  and auditable in the PNP debugger.
- The transcript reaches screen-reader users through reading order: the labeled
  region sits immediately before the content it transcribes.
- Revealing the transcript must not move focus.
- In delivery an ungranted accommodation transcript is not rendered, so it is
  absent from the accessibility tree.

## Standards Or Adapter Impact

`transcript` is an AfA/PNP 3.0 support token and QTI 3 carries transcript-style
alternates as catalog cards, so the mapping is direct. As with signing, QTI is
inspiration rather than an interop target, and no conformance is claimed.
Autoplay has no standards token; AfA's nearest neighbor is `audioControl`.

## Test Plan

- `packages/default-tool-loaders/tests/audio-transcript-registration.test.ts`
  covers card resolution (an `"always"` card with or without a grant, an
  accommodation card only when granted, absent `visibility` as the
  accommodation, empty text ignored, `"always"` preferred) and packaging (the
  packaged set, its own support id and content dependency, absence from the
  universal profile, no toolbar placement, consulted without a grant).
- `packages/section-player/tests/audio-transcript-surface.test.ts` covers the
  labeled region, grant gating, the card language on the region, nothing
  without a card, and re-sync to the current card.
- `packages/assessment-toolkit/tests/policy/host-feature-gate.test.ts` covers
  host denial of `transcript` against a granting profile.
- `packages/print-player/tests/accessibility-alternates.test.ts` and the
  Playwright spec `print-accessibility-alternates.spec.ts` cover print gating,
  the visible label, catalogs carried by the item and by a model, district
  precedence and item settings.

Commands:

```sh
bun run typecheck
bun run test
bun run check:source-exports
bun run check:consumer-boundaries
```

Playwright-backed tests must run outside the sandbox.

## Rollout And Release Notes

- Migration notes: a host that relied on the legacy ancestor class must grant
  `transcript` in the affected students' profiles. The class no longer delivers
  anything.
- Documentation: the integrator guides linked at the top, the
  [tools and accommodations architecture](../tools-and-accomodations/architecture.md),
  the [accessibility catalogs quick start](../accessibility/accessibility-catalogs-quick-start.md)
  and the [integration guide](../accessibility/accessibility-catalogs-integration-guide.md).
- Release risk: both failure directions are silent, a missing transcript for a
  student who needs one and a visible transcript on a listening item for a
  student who does not.

## Open Questions

- **Is item-granular placement acceptable for the transcript?** The transcript
  renders above the item content, not immediately above the audio control
  inside the element's layout. Reading order is preserved; adjacency is not.
  This needs the requirement owner's confirmation. The alternative is an element
  reading the support from the ADR 0003 context and placing the transcript
  itself.
- **Is runtime-adjustable autoplay required?** Autoplay is the per-model
  `autoplayAudioEnabled` field, set at import from the item's collection, and
  the item player's `autoplay-audio-enabled` attribute overwrites it on every
  model of one player instance. `mc-populated-blank` keeps its Listen button
  or native audio controls on screen when autoplay is on. A policy id is
  justified only if a teacher or district must change autoplay at delivery
  time; if per-program content is the answer, the
  content transform settles it with no change in PIE. `completeAudioEnabled` on
  its own makes multiple-choice (and EBSR through it), categorize, hotspot,
  drag-in-the-blank, image-cloze-association and `mc-populated-blank` report
  `complete: true` only once the prompt audio has played to the end, so turning
  autoplay off for such items leaves them waiting on the audio.
