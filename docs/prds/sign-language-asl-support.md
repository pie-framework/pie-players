# Sign Language (ASL) Support

Status: Accepted for the `pie-players` contract, which is implemented and is the
current reference. The `pie-elements-ng` and `pie-api-aws` halves were complete
as of 2026-08-10.

Owner: PIE Players maintainers

Tracking: delivery was tracked as three stories, one per repo the feature crosses, opened 2026-08-07. This PRD is the contract; the tracker is the delivery record.

| Repo | Scope | Status |
| --- | --- | --- |
| `pie-elements-ng` | Verify the dormant `accessibilityCatalogs` model carries sign-language cards. | Done |
| `pie-players` | Extract, resolve, and render `sign-language` cards in a section-player region. Depends on the `pie-elements-ng` story for the payload shape. | Done |
| `pie-api-aws` | Carry ASL video through the Learnosity→PIE import transform; end-to-end proof using real ASL item samples. | Done |

The `pie-api-aws` story is the integration proof for all three. The pipeline is Learnosity source → `pie-api-aws` transform → PIE item `accessibilityCatalogs` → `pie-players` render; a story landing in isolation proves nothing until that path runs end to end.

**Implementation status, 2026-08-26.** All three stories are Done. The `pie-players` half landed on `develop`: the card contract in `players-shared`, resolution, the content-scoped media region, and `signLanguage` policy gating, extracted into `@pie-players/pie-tool-sign-language` on 2026-08-10. The `pie-api-aws` half landed the same day: the Learnosity→PIE transform detects the Feature form of a signing video and writes a `sign-language` catalog card, filed per model rather than at the item root, resolving the clip's MIME type from its extension. The import path is proved in-repo by `packages/section-player/tests/pie881-imported-asl-integration.spec.ts`, which renders the unmodified output of `mapLearnosityItemToPieItem` — synthetic source item, public-domain clip, so both fixture and spec are committable — and asserts it resolves, gates and plays. The transform was also proven end-to-end against a real item in `pie-api-aws`, but that item cannot live in any repository, so the demo's clip stays a stand-in that does not sign the demo's prompts — see the video-sizing open question below, which that proof did not close. Decisions taken while building this are recorded in [Resolved Decisions](#resolved-decisions), and where they supersede an earlier line in this PRD, that line says so.

A `pie-elements-ng` change sequenced ahead of all three retired `@pie-element/core`, a dead package whose stale copy of the type model made a single canonical `accessibilityCatalogs` definition look like two competing ones. It was not ASL work and not a code dependency; it left this work one type home.

Naming: the feature is ASL support, because the work is catalog/PNP/accommodation-shaped rather than video-player-shaped. See [Relationship To Section-Player And To Timed Media](#relationship-to-section-player-and-to-timed-media). Signed English (`eng-US`) rides the same card type, which a video-centric name would obscure.

**Direction.** The maintainers' engineering direction, set before the prototype; each bullet says whether it shipped or stands as a decision:

- **Link video to the existing item id; do not clone a separate ASL item.** Resolves [The Import Invariant](#the-import-invariant) below toward "merge," chosen for scalability and lower technical debt over the simpler clone-based path. Shipped 2026-08-10: the importer files the card against the existing item.
- **Default the video's own audio off** — shipped: the region renders `<video muted>`. Which audio channel that settles is still only the signing track; whether the item's own narration should also be suppressed while a signed alternate plays is untouched by this, and related to but not the same decision as the [TTS-versus-signing coordination](#resolved-decisions) rule below.
- **Keep the framework generic, not ASL-specific.** Corroborates this PRD's existing catalog/`MediaAssetRef` reuse rather than changing it.
- **Authoring tooling is explicitly deferred.** Ship rendering now; hold off on any UI for authoring cue/catalog data until a concrete use case exists. Reinforces the existing Non-Goal below rather than changing it.
- **Presentation is settled for the first iteration** — fixed right-side split, resizable, no orientation options. See [Region Presentation](#region-presentation).

Checked against shipped source on 2026-08-26.

Related architecture:

- [Accessibility Catalogs Quick Start](../accessibility/accessibility-catalogs-quick-start.md)
- [Accessibility Catalogs Integration Guide](../accessibility/accessibility-catalogs-integration-guide.md)
- [Media asset contract](./shared-contracts/media-asset-contract.md)
- [Accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md)
- [Timed media section architecture](../architecture/timed-media-section.md) — related media work, but a different mechanism; see [Relationship To Section-Player And To Timed Media](#relationship-to-section-player-and-to-timed-media)

Product-side counterparts live in the product wiki, outside this repository:

- the student and authoring experience spec for signing video, which names this PRD as its canonical source for implemented behaviour, so a change here that alters delivery behaviour needs its state tables re-checked. Its authoring half has no counterpart in this repo and is not constrained by this PRD;
- the accommodation catalog model page;
- the item and passage authoring template, whose companion-slot shell assumes signing, spoken script, transcript, translation, braille and tactile graphics share one grain and one slot. This PRD does not make that assumption;
- the signing video CMS operations page: production, rights and coverage, all host-owned per [Data Ownership And Host Responsibilities](#data-ownership-and-host-responsibilities).

## Problem

Deaf and hard-of-hearing learners need item language delivered in sign language. PIE has the vocabulary for this and none of the behavior:

- `CatalogType` in `AccessibilityCatalogResolver` already listed `"sign-language"`, but before this work nothing rendered it: the only consumer of `getAlternative()` was `TTSService`, for `spoken`. Section-player now calls it for `sign-language` too — see the implementation note above.
- The toolkit's reference vocabulary, since removed, listed `signLanguage`, `signLanguageInterpretation`, and `visualLanguage`, but no tool declared those `pnpSupportIds`, so no PNP support activated anything.
- `CatalogCard.content` is a flat `string`. A signing video needs more than one URL.

The gap is visible in real content. Imported Learnosity items carry ASL video and render it in the Learnosity view; the PIE view of the same item shows the multiple-choice question with no video, because nothing translates that content into a PIE-renderable alternate representation.

### What ASL Is, In PIE Terms

Four domain facts drive this contract. Getting them wrong produces the wrong architecture, and most of them contradict a plausible first guess.

1. **ASL video translates the prompt, not the passage.** Learnosity's "stimulus" field corresponds to what PIE calls **prompt** — not to what PIE calls **passage**. The signing video is a translation of the prompt into another language. It is not shared context framing several items, so it is not passage-shaped and not section-shaped.

2. **ASL coexists with written English; it does not replace it.** Spanish translation in current authoring practice produces a different item (a different id, not just a different content version), all in Spanish with no English. ASL cannot work that way, in significant part because ASL is not written down in everyday practice — transcription systems exist but are of theoretical interest rather than part of most signers' linguistic practice. Deaf learners in the US typically use ASL for real-time communication and English for reading and writing, often with very different fluency in each, and in either direction depending on whether deafness was congenital. So the ASL video must sit **alongside** the English content in the same item, as an alternate representation, not as a translated sibling item.

3. **Language-bearing content beyond the prompt may also need signing.** Answer choices expressed as language plausibly need signed translations too. Choices expressed as images do not. Granularity therefore has to reach below the item — the card model must stay per-content-node capable even though today's content does not exercise it. The sample items are one video per item, and their choices are images, so per-node docking is a future capability rather than an MVP concern — and as of 2026-08-26 explicitly out of near-term scope, without giving up the capability. See [Resolved Decisions](#resolved-decisions).

4. **It is an accommodation in PIE, and that is a deliberate divergence from the source.** Authoring and content — effectively the video links — are item-level, roughly 1-1 with items, and content authors treat ASL-supported items as dedicated items even where they are engineering copies. But *when and how* the video is exposed is a toolkit decision through catalogs and policy. That makes it an accommodation both technically and logically: the video adds no assessed content, measures the same construct the same way, and merely presents it in another language. That is what separates an accommodation from a different item, and it is why Spanish needs a sibling item while ASL does not.

   Learnosity does not model it this way. Its content model splits into Questions and [Features](https://help.learnosity.com/hc/en-us/articles/16684575643549-feature-types) — non-scored components including Audio player, Passage, and Video player — so a signing video is ordinary item content and renders unconditionally, with nothing to gate. The ETL is therefore performing a semantic transformation, not a translation, and should be written knowing that.

This is why the accessibility catalog is the right rail: catalog cards attach to arbitrary content nodes through `data-catalog-idref`, they are additive to the English content rather than a substitute for it, and PIE already docks TTS this way. That parallel is the strongest evidence the model is right — authored `<speak>` SSML is item-level content that `SSMLExtractor` lifts into item catalogs and the toolkit plus policy decide whether to expose. Signing is the second instance of a shipped pattern, not a new one.

A catalog owner's `ownerKind` is already `"global" | "passage" | "itemModel"`, so passage-scoped signing cards are structurally supported without new plumbing.

### The Import Invariant

Because the source has two Learnosity items (a base and an ASL copy) while PIE wants one item carrying cards, the importer must either merge them or emit both. The invariant either choice must satisfy:

> The item a student receives must carry the cards that student's profile can use.

Merging satisfies this trivially. Emitting both satisfies it only if assembly and policy agree, and the failure mode is quiet: serve a "dedicated ASL item" to a student without the accommodation and gating hides the video, producing an ASL item that shows no ASL.

**Resolved: merge.** Link the signing video to the existing item id rather than cloning a separate ASL item, chosen for scalability over a simpler clone-based path that would have covered a narrower near-term delivery target. Shipped in `pie-api-aws` on 2026-08-10: the transform files the card against the existing item.

## Goals

- Render `sign-language` catalog cards as a learner-facing alternate representation, docked to specific content nodes via the existing `data-catalog-idref` mechanism.
- Support prompt-level granularity as the MVP, with a path to choice-level and other language-bearing nodes.
- Define a catalog card payload for signing video that carries multiple sources, MIME types, poster, and optional time range, instead of a bare URL string.
- Gate availability on PNP (`signLanguage`) through the existing `ToolPolicyEngine` / `PnpPolicySource` path rather than a parallel mechanism.
- Define coordination rules so signing playback, TTS, and other media do not compete.
- Follow the QTI 3 catalog model where it already fits, so the shape stays recognizable to anyone who knows the standard and a future adapter has something to map. QTI 3 is *inspiration*, not a target: no interoperability or conformance commitment is made here, and where the standard and PIE's needs diverge, PIE's needs win.

## Non-Goals

- No cue-driven orchestration. This PRD does not reveal, gate, pause, or sequence items from media time. That is [timed media](./timed-media-section-contract.md), a different contract.
- No separate translated item variant for ASL. See fact 2 above.
- No ASL video production, storage, CDN, signed URLs, or retention. Host-owned.
- No synthetic signing, signing avatars, or machine translation.
- No Learnosity→PIE import implementation. The ETL/import path lives outside `pie-players`; this PRD defines the PIE-side target shape that an importer writes into.
- No authoring UI for creating or editing cue/catalog data. Explicitly deferred — see the direction callout above: ship rendering now, build authoring tooling only once a concrete use case exists.
- No QTI conformance claim. Mapping belongs in `pie-qti`.
- No video player component shared with `video-stimulus`; see [Resolved Decisions](#resolved-decisions).

## Package And Export Ownership

- Owning package for the generic machinery: `@pie-players/pie-assessment-toolkit` (source at `packages/assessment-toolkit`). It owns `AccessibilityCatalogResolver`, the PNP feature vocabulary, `ToolPolicyEngine` and the registration contract, and names no capability.
- Owning package for signing itself: `@pie-players/pie-tool-sign-language` (source at `packages/tool-sign-language`), added 2026-08-10. It holds the card validation, the content resolver, the registration and the region element. Signing is the worked example of a capability contributed from outside the player: it is not in `createPackagedToolRegistry`, so a deployment opts in by registering it.
- Owning package for data types: `@pie-players/pie-players-shared` (source at `packages/players-shared`), where `CatalogCard`, `AccessibilityCatalog`, and `PersonalNeedsProfile` already live.
- Runtime host: `@pie-players/pie-section-player`, same as spoken/TTS catalogs today. It offers the `content-media` surface and mounts whatever is registered on it; it does not depend on the signing package and does not name signing, the `signLanguage` support id or the `sign-language` catalog type.
- Rendering placement: **a content-scoped region shared by item and passage cards**, alongside the `header` and `content` regions they already declare — decided 2026-08-07, generalized from the original item-only placement on 2026-08-10, and reached through the generic `content-media` surface rather than by name. Not a toolbar surface, and not an item-player affordance. `item-player` needs to know nothing about signing.
- Policy identity: **signing takes a feature id and registers for policy**, so it inherits the eight-level precedence in `PnpPolicySource`: `district-block`, `test-admin-override` set to `false`, `item-restriction`, `pnp-prohibited`, `test-admin-override` set to `true`, `item-requirement`, `district-requirement`, `pnp-support`. Policy identity and rendering placement are deliberately separated here; see [What Counts As A Tool](../tools-and-accomodations/architecture.md#what-counts-as-a-tool).
- Public export path: `@pie-players/pie-tool-sign-language` for the registration, the card validators and the content resolver. The generic media-payload helpers (`applyMediaFragment` and the normalizers) are owned by `@pie-players/pie-players-shared/media`, which the signing package imports.
- Consuming packages or apps: `section-player`, `assessment-toolkit` registry and policy engine, demo apps, `pie-elements-ng` only if per-node docking below the prompt is later scoped, and `pie-qti` adapters.
- Runtime environment: browser and custom element; data types must stay Node-safe for importers and adapters.

### Why A Region Rather Than A Tool Surface

Two things were being coupled that should not be. The card's `data-catalog-idref` says **what** the video translates; the layout says **where** it appears. With one signing video per item — which is what the content actually has — the region does not need to sit adjacent to a specific DOM node, so placement becomes a layout concern and presentation stays policy-driven rather than hard-coded.

This also keeps the platform from limiting presentation. Because signing has a feature id, its availability *and* its presentation parameters can be set at host, district, test-administration, item, and student level through machinery that already exists — `settings.districtPolicy`, `settings.testAdministration`, an item's `settings.toolParameters`, and `personalNeedsProfile`. Only the parameter vocabulary is new; the seam is not.

**Per content card, not section-wide.** An earlier draft said "the way the passage shell has one," which was underspecified: a passage sits *once* beside a column of items because a passage is genuinely shared across them, and a *section-wide* region would be the wrong shape for signing. What shipped is one region per content card — both `SectionItemCard.svelte` and `SectionPassageCard.svelte` render the same `SectionCardMediaSplit`, differing only in owner scope, and the registration declares `supportedLevels: ["item", "passage"]`. Passage-owned signing therefore renders today; it is not a separate placement and not pending release. An earlier revision of this paragraph said the region belonged in the item card only, which was true of the first cut and stopped being true on 2026-08-10.

**Name the region generically, not `asl`.** The thing filling the slot is a resolved catalog card, which is already a generic mechanism, and the most plausible second occupant is a near neighbor on the same rail rather than a hypothetical — audio description is the same "docked alternate media, gated by PNP" shape. Naming the slot after its first tenant would force a rename for no present saving, since the component and CSS are identical either way. Low-stakes and reversible if a second consumer never appears.

### Region Presentation

Decided 2026-08-07, and deliberately minimal for the first iteration:

- **Fixed default: to the right of item content.** Two reasons, and the second is the decisive one. Text-first sequencing argues for the item anchoring the primary/left position in an LTR reading flow. More importantly, a bottom placement imposes a scroll-away cost: signing is re-checked *while* forming an answer, not read once beforehand, so a video below the content means scrolling down to the video and back up to the choices, repeatedly. A side-by-side split keeps both visible regardless of item length. Being parallel rather than sequential, it also sidesteps a problem an above/below split cannot solve — `item-player` renders prompt and choices as one opaque block, so there is no way to place the video "after the prompt, before the choices" without breaking the boundary that keeps `item-player` ignorant of signing.
- **Resizable, following the existing divider pattern.** `SectionSplitDivider.svelte` is the prior art: pointer-based, keyboard-accessible, `role="separator"`, percentage-bounded. It is coupled to the passage/items grid and hardcoded to one orientation, so this was "follow the pattern," not "import the component" — what shipped is a sibling, `SectionCardSplitDivider.svelte`, with the same affordances and its own percentage bounds.
- **No configurable orientation and no free drag-to-reposition in the first iteration.** Free 2D repositioning is the `ItemToolBar` floating-window pattern, built for movable utility windows like the calculator; dragging a signing video to an arbitrary spot over item content is more affordance than the accessibility need calls for. Build the four-orientation, policy-gated generalization only once there is a signal it is needed — the `toolParameters` seam is already the right place to hang it, but nothing hangs there yet. There is also no layout-related policy surface today: `SectionPlayerPolicies` covers only readiness, preload, and telemetry.

Worth folding in while touching this: `SectionItemCard.svelte` and `SectionPassageCard.svelte` already hand-duplicate the same header/content/footer structure. Adding a media region is a reasonable moment to factor that into one shared shape rather than writing a third copy. Partly taken — the media region itself is one shared component both cards render; the surrounding header/content/footer duplication was left alone. See [Resolved Decisions](#resolved-decisions).

## Contract Shape

The names below are the shipped ones, not a proposal — this section described two changes that were needed and have since landed: a card payload that can describe video, and a resolution/render path that consumes it.

```ts
// Documentation sketch only.

// `content` carries the string form; a media card carries a typed `payload`.
interface SignLanguageCardPayload {
  /**
   * ISO 639-3 sign language code. "ase" = ASL, matching QTI 3 `xml:lang`.
   * This is the LANGUAGE OF THE ADAPTATION, not the item's base content
   * language — AfA/PNP's `languageOfAdaptation` distinction, and a real one:
   * a Spanish item's signed alternate is LSM, not ASL, so `signLang` must
   * never be inferred from the item/assessment content language. Decided
   * 2026-08-07. Optional, and only worth authoring where it differs from the
   * card's `language`, which is what resolution selects on — see Resolved
   * Decisions.
   */
  signLang?: string;
  /** Reuses the shared media contract rather than inventing media fields here. */
  media: MediaAssetRef;
  /**
   * Optional time slice of a longer signing video, so one recording can serve
   * several content nodes. Mirrors QTI 3's Media Fragments URI usage.
   */
  fragment?: { startSeconds: number; endSeconds?: number };
}

/** A recorded `spoken` alternate. */
interface SpokenAudioCardPayload {
  media: MediaAssetRef;
  fragment?: { startSeconds: number; endSeconds?: number };
}

type CatalogCardPayload = SignLanguageCardPayload | SpokenAudioCardPayload;

interface CatalogCard {
  catalog: string;    // QTI's `qti-card@support` — the only discriminator
  language?: string;
  content?: string;   // the string form; absent on cards that have none
  payload?: CatalogCardPayload;  // the structured form, read according to `catalog`
}
```

**Either `content` or `payload`, never both — decided 2026-08-08 during implementation,
superseding the tagged-union sketch this section originally carried.** Two
duplications came out of that sketch, and both were removed:

- **The payload carried a `kind`.** It restated `catalog`, which is QTI's
  `qti-card@support` and already the discriminator, so the two could disagree.
  Consumers select a card by catalog type and then validate the payload
  structurally, which authored wire data requires anyway.
- **The primary URL was mirrored into `content`.** Mirroring buys a second copy
  to fall out of sync and a precedence rule deciding which copy wins. `content`
  is therefore optional, and a signing card carries no string form at all.

This makes `CatalogCard.content` and `ResolvedCatalog.content` optional, a
breaking change to two published types — taken deliberately while nothing outside
this repo consumes catalogs beyond TTS. `TTSService` treats a card with no string
form as "no catalog" and falls through to generated speech.

Both landed producers, `pie-elements-ng` and the `pie-api-aws` Learnosity
importer, first carried the media block under `signLanguage`. An input alias for
it was accepted on 2026-08-08 and withdrawn the same day: it was folded in on the
resolution path only, so an aliased card rendered its video while
`hasAlternativeType(..., "sign-language")` reported none. Both producers now emit
`payload`, and the alias is gone from the type, from `resolveCard`, and from
`resolveSignLanguageMedia`. All three repos declare one card shape: a single
generic `payload` slot interpreted by `catalog`, which is what QTI's
one-content-slot `qti-card` describes and what keeps braille, the next structured
alternate, additive. `resolveSignLanguageMedia` warns on any `sign-language` card
it cannot resolve, so a card left over from the old spelling says so.

A host shipping this player against content built by the older element types or
the older importer sees signing cards stop resolving, with that warning as the
signal.

`MediaAssetRef` is reused deliberately rather than defining media fields here — decided 2026-08-07 — to avoid two media vocabularies in one codebase. Two consequences the accepted contract must carry:

- Optionality is resolved per consumer, not by making every field optional at the type level (which would stop the type catching anything). This answers an open question already posed in the media asset contract. For signing: sources and language are required; poster and duration are not applicable.
- `tracks` and `transcript` are not merely optional here, they are **meaningless**. Captions on a signing video would be the English text already on screen. Stated explicitly so no future policy adds a caption requirement to signing media.

Resolution and gating reuse existing seams:

- owner traversal and precedence stay in `AccessibilityCatalogResolver`; the content capability receives one immutable owner snapshot and applies strict `sign-language` and requested-language matching itself;
- docking stays `data-catalog-idref` on the content node, the same attribute `SSMLExtractor` writes and `TTSService` reads;
- eligibility comes from `PnpPolicySource`, at any level of its precedence — not from the student profile alone.

### Availability Rule

Signing is available when **both** conditions hold: the content carries a matching `sign-language` card, and policy grants eligibility. Both are required, and they are checked independently.

This is deliberately not framed as "default on versus default off." The content condition is the DRD half of AfA's matching pair (see [What Counts As A Tool](../tools-and-accomodations/architecture.md#what-counts-as-a-tool)), and it is what prevents a dead affordance on the overwhelming majority of items that carry no signing video — regardless of what the computed default profile happens to say. The eligibility half follows the accommodation tier: not granted by default, because signing requires a documented need.

Revised 2026-08-09: the core no longer synthesizes a default profile, so there is nothing for signing to leak into. An earlier version of this line required excluding `signLanguage` from `computeDefaultSupports()` by id; that derivation and its exclusion list are both gone. Signing instead declares `requiresAuthoredContent`, which is what keeps it out of a host's wholesale grant structurally. Hosts that supply their own profile are unaffected either way.

Validation: `sign-language` cards need indexing and validation distinct from text cards, since a malformed media payload must not silently degrade to an empty string or render a URL as visible text.

## Compatibility

This PRD touches these surfaces:

- **Contract attributes.** It adds a second consumer of `data-catalog-idref`. TTS behavior through that attribute must not change; the attribute stays one canonical name with two readers.
- **Persisted/authored wire data.** `CatalogCard` gains a payload shape. Existing `{ catalog, language?, content }` cards keep resolving unchanged, and `content` is where every text-ish type still lives. Revised 2026-08-08: an earlier version of this bullet also required `sign-language` cards carrying a bare URL in `content` to keep working as a legacy single-source form. That requirement is dropped — no producer writes that shape, and accepting it would mean a second code path and a second source of truth for the same URL while silently discarding the MIME type, label, and any second source. Such a card is now reported and ignored.
- **Default PNP.** Signing must be explicitly opted into (decided 2026-08-08). The mechanism changed on 2026-08-09: rather than excluding `signLanguage` by id from a profile computed off the packaged registry, the core stops computing a profile at all — `createEmptyPersonalNeedsProfile()` grants nothing, and `@pie-players/pie-default-tool-loaders` ships the universal set as a named preset a host adopts. Signing's registration declares `requiresAuthoredContent`, so a host building its own grant list has a declaration to filter on instead of a compile-time array it cannot extend.
- **`pie-elements-ng`.** Choice-level docking requires element markup to carry `data-catalog-idref` on choice nodes. That is element-repo work and must not be faked by synthesizing ids in the player.

It must not change PIE element runtime/controller contracts, versioned `pie-*` tag names, `pie-item-player` properties/events/methods, section completion state, or assessment-player routing.

Do not strip, normalize, prefix, or slug catalog identifiers. `data-catalog-idref` values are author-owned and must round-trip byte-for-byte.

## Data Ownership And Host Responsibilities

PIE owns:

- the sign-language catalog card vocabulary and payload validation;
- resolution priority, language matching, and fallback behavior;
- PNP gating and policy provenance for signing availability;
- the learner-facing affordance: how a signed alternate is discovered, opened, played, and dismissed;
- coordination with TTS, other media, and player tools;
- accessibility behavior of player-owned signing UI.

Hosts own:

- signing video production, storage, CDN, signed URLs, CSP, authorization, retention, and privacy;
- accommodation eligibility — whether a given learner gets `signLanguage` at all;
- content authoring quality, including translation accuracy and coverage;
- import/ETL from external formats such as Learnosity into PIE catalog shape;
- reporting on accommodation usage.

## Serialization And Versioning

Catalog data is authored and wire-facing. The contract settles:

- versioning: the sign-language payload carries no version marker of its own. Its `media` is a `MediaAssetRef`, and this build renders only `version: 1` (`SUPPORTED_MEDIA_ASSET_VERSION` in `@pie-players/pie-players-shared/media`). A card whose media claims another version is reported and ignored; one whose media omits `version` is accepted, since producers predate the field;
- validation ownership: `@pie-players/pie-tool-sign-language` validates sign-language cards (`resolveSignLanguageMedia`), using the generic media normalizers in `@pie-players/pie-players-shared/media`;
- unknown-`catalog`-type behavior: unknown types are tolerated by `CatalogType`'s `| string` tail and ignored rather than rejected, with one report per token (see [Resolved Decisions](#resolved-decisions));
- unknown-payload-shape behavior: a `sign-language` card whose payload does not validate is treated as absent and is never rendered as raw text;
- fixtures: the package's card tests cover single-source, multi-source, poster, fragment-range and missing-language cards, plus the two rejected shapes (bare-URL `content`, and a payload with no usable source).

## Accessibility

This PRD is accessibility-scoped. It consumes [accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md).

Standards framing matters here: WCAG 2.2 covers sign language only at SC 1.2.6 (Sign Language, prerecorded), which is **Level AAA** and scoped to prerecorded audio in synchronized media. Signing a text prompt is not a WCAG AA obligation at all. ASL support in PIE is therefore driven by assessment accommodation policy and 1EdTech's Elevated Accessibility expectations, not by the repo's WCAG 2.2 AA baseline. Do not justify it as an AA requirement, and do not treat AA conformance as evidence that signing is covered.

Requirements:

- the signing affordance is keyboard reachable and labelled, and its label names the language (for example "American Sign Language") rather than a generic "video";
- opening and closing signing playback moves focus predictably and restores it on dismiss;
- signing playback and TTS must not run simultaneously: starting either pauses the other (see [Resolved Decisions](#resolved-decisions));
- the English content the card is docked to stays visible while signing plays, because both languages are in use — signing must not replace or obscure the prompt it translates;
- signing UI must not obscure captions, transcripts, media controls, or answer choices;
- playback controls must include pause, replay, and speed where the player provides them, since re-watching is normal for translation rather than exceptional;
- high-contrast, 200% zoom, touch-target, and reduced-motion behavior must be verified;
- availability must be discoverable when granted and absent when not, with no dead affordance for learners without the accommodation.

Manual review is required. Automated checks cannot judge whether a signing affordance is findable or whether focus handling is sensible mid-item.

## Standards Or Adapter Impact

QTI 3 is **inspiration, not an interop target.** PIE's catalog model borrows the standard's vocabulary because that vocabulary is good and widely understood, not because PIE promises to consume or emit QTI. The mapping below is therefore a side benefit worth keeping cheap — it tells a future adapter where to start, and it keeps PIE from inventing a second name for a concept the standard already names well. It is not a constraint on the design: where the standard and PIE's needs diverge, PIE's needs win, and the divergence gets recorded rather than designed around.

| QTI 3 / APIP | PIE | Note |
| --- | --- | --- |
| `qti-catalog id="..."` | `AccessibilityCatalog.identifier` | Direct. |
| `qti-card support="sign-language"` | `CatalogCard.catalog: "sign-language"` | Token already matches. |
| `qti-card-entry xml:lang="ase"` | `CatalogCard.language` | ISO 639-3; `ase` is ASL. The payload's optional `signLang` names the same code and is only authored where it differs. |
| `qti-html-content` with `<video>` and multiple `<source>` | `SignLanguageCardPayload.media` | Today's flat `content: string` cannot carry this. |
| Media Fragments URI on the source | `fragment` | QTI 3 replaced APIP's separate start/end cue elements with fragment notation, letting one recording serve several nodes. |
| `data-catalog-idref` docking, conventionally on a hidden docking div | `data-catalog-idref` | Already the same attribute PIE uses for TTS. |
| APIP `signFileASL` / `signFileSignedEnglish` | catalog card + language | APIP's two sign types collapse into card language. Signed English is scoped out for MVP; see [Resolved Decisions](#resolved-decisions). |
| PNP 3.0 / AfA `sign-language` | `PersonalNeedsProfile.supports` | `signLanguage`, the sign-language tool's id: the AfA term, camelCased. |

The table covers signing and is not a survey of the catalog model. Two places where PIE's shape and the standard's diverged are settled in [Resolved Decisions](#resolved-decisions): QTI's `spoken` card may carry a pre-recorded audio file, which PIE reads as `SpokenAudioCardPayload`, and `ext:`-prefixed vendor support tokens, which `isKnownCatalogType` accepts in an open `CatalogType`.

Import/export mapping, if it is ever built, belongs in `pie-qti` and is where any lossy transform gets documented — in particular whether the hidden-docking-div convention survives a PIE round trip.

## Relationship To Section-Player And To Timed Media

**Section-player is the runtime host** for signing, and there is nothing new about that: the accessibility catalog resolver lives in `assessment-toolkit`, which section-player consumes, and section-player already renders `spoken` catalog cards through the same path that this PRD extends. Signing is a new *type* of catalog card and a new *renderer*, not a new host. The host relationship is by surface rather than by name: section-player mounts whatever declares `surfaces: ["content-media"]`, and signing lives in its own package.

What this PRD is *not* is a new section flavor. [Timed media](./timed-media-section-contract.md) is a section flavor — it introduces `sectionType: "timed-media"` and cue orchestration, and runs in the existing section-player layouts — because it composes multiple items around a shared timeline. Signing does none of that: many short recordings, each translating one content node, played on learner demand, gating nothing.

An earlier intuition was to model ASL as a passage and build a specialized ASL section layout. That framing is rejected by facts 1 and 2 above: the video translates a prompt rather than framing multiple items, and it must coexist with the English content inside the same item. The rejection is about *modeling ASL as a passage*, not about section-player involvement.

| | Timed media | Sign language |
| --- | --- | --- |
| Runtime host | Section-player (existing layouts) | Section-player (existing catalog rail) |
| Section-level flavor? | Yes (`sectionType`) | No |
| Media count | One shared stimulus | Many short recordings |
| Timeline role | Reveals, gates, sequences items | None |
| Trigger | Playback position | Learner demand |

The one genuine data overlap is time-ranged playback. QTI 3's Media Fragments usage means a single signing recording can serve several content nodes by time slice — the same "video plus timestamps" primitive timed media needs, without any of the cue policy. If both contracts land, that primitive should be shared. See the open question on time ranges in [`./shared-contracts/media-asset-contract.md`](./shared-contracts/media-asset-contract.md).

## Test Plan

Required test coverage:

- resolver fixtures for `sign-language` cards: assessment-level, item-level, and scoped owner contexts, with language match, fallback, and miss;
- payload validation fixtures for single-source, multi-source, poster, fragment range, and malformed payload, plus one pinning that a bare URL in `content` resolves to nothing and that a payload under any other key name does too;
- docking tests proving a `data-catalog-idref` node resolves a signing card without changing TTS resolution for the same attribute;
- PNP gating tests: affordance absent without `signLanguage`, present with it, and absent when prohibited via `prohibitedSupports`;
- a regression test pinning that `signLanguage` stays out of any wholesale grant: the core's profile grants nothing, and the composition package's universal preset excludes every id belonging to a registration that declares `requiresAuthoredContent`;
- keyboard and focus tests for opening, playing, and dismissing the affordance, including focus restoration;
- TTS/signing mutual-exclusion tests;
- a test that the docked English content remains visible during signing playback;
- accessibility evidence, including manual screen-reader and keyboard walkthroughs, per the accessibility runtime patterns PRD.

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

- Changeset required: yes. This adds public exports, a section-player region and (2026-08-10) the `@pie-players/pie-tool-sign-language` package, under the lockstep versioning policy.
- Migration notes: additive for authored content — existing `spoken`, `braille` and other string-form catalogs keep working untouched. Not additive at the type level: `CatalogCard.content` and `ResolvedCatalog.content` became optional (see [Contract Shape](#contract-shape)), so a consumer that reads `.content` as a `string` needs a guard. Hosts supplying their own `PersonalNeedsProfile` see no behavior change until they grant signing eligibility.
- Documentation updates: accessibility catalog quick start and integration guide, tools-and-accommodations docs, the PNP debugger tool docs, and `pie-qti` adapter PRDs.
- Release risk: medium-high. The runtime surface is small, but it is an accommodation — a silent failure means a learner cannot read the item at all, and the failure mode is invisible to hosts that do not test with `signLanguage` granted.

## Resolved Decisions

Settled in review 2026-08-07 and inlined into the sections above rather than left as questions:

| Decision | Outcome |
| --- | --- |
| Accommodation or item content? | Accommodation. Item-level authoring, toolkit-controlled exposure. Deliberate divergence from Learnosity's Feature model. |
| Rendering placement | A region per content card, beside the existing `header`/`content` regions. Superseded 2026-08-10: originally item-only, generalized so `SectionItemCard.svelte` and `SectionPassageCard.svelte` render one shared `SectionCardMediaSplit` and the registration declares `supportedLevels: ["item", "passage"]`. Not section-wide like the passage shell, not a toolbar surface, not an item-player affordance. |
| Region presentation | Fixed default to the right of item content, resizable via the `SectionSplitDivider.svelte` pattern. No configurable orientation and no free drag in the first iteration. See [Region Presentation](#region-presentation). |
| Region naming | Generic (media/catalog-media), not ASL-specific — the slot holds a resolved catalog card, and audio description is the same shape. |
| Policy identity | Takes a feature id and registers for policy, inheriting the PNP precedence. Separate from rendering placement. |
| Presentation limits | None imposed by the platform. Driven by policy at host, district, test-administration, item, and student level via existing seams; only the parameter vocabulary is new. |
| Default availability | Requires a matching card *and* eligibility; `requiresAuthoredContent` keeps signing out of any wholesale grant. |
| Media payload | Reuse `MediaAssetRef`; declare the required subset per consumer; `tracks`/`transcript` meaningless for signing. |
| Player component | Minimal `<video>` wrapper. Not shared with `video-stimulus` — the clips are seconds long, and a dependency on an unbuilt element buys nothing. |
| Per-choice docking | **Out of scope, decided 2026-08-26.** Not a near-term focus: the stated product requirement is one video per question, and the sample content is one video per item with image choices. This is a scope decision, not a judgement that per-choice signing is wrong — [fact 3](#what-asl-is-in-pie-terms) still holds for language-bearing choices. What keeps the door open costs nothing to maintain: the card model stays per-content-node capable, `data-catalog-idref` stays author-owned and byte-for-byte, and resolution takes the first card for the scope rather than assuming one exists. Reopening it is additive — `data-catalog-idref` on choice nodes from `pie-elements-ng`, and a resolver that returns more than one card per scope. Nothing needs undoing first. |
| TTS versus signing | The action the learner just took wins; starting one pauses the other. |
| Signed English in scope? | Not needed for current (US) scope. Distinct from the international sign-language question below; don't conflate the two. |
| Multi-signed-language capability | Ships as part of the base design at no extra cost — same card-array-plus-`language` mechanism already used for multi-language spoken TTS, applied to a new catalog type rather than built new. Default to *no* cross-sign-language fallback (show nothing rather than silently substitute a different sign language a student may not follow); revisit only if real usage shows the strict default is wrong. |
| Item model, clone vs. link | Link video to the existing item id rather than cloning. Shipped 2026-08-10. See [The Import Invariant](#the-import-invariant). |
| Default audio state | Shipped: the region renders `<video muted>`, which settles the signing track. Whether the item's own narration is suppressed while signing plays stays open — see the callout at the top of this PRD. |
| Authoring tooling | Explicitly deferred until a concrete use case exists. Ship rendering first. |

Settled during implementation, 2026-08-08:

| Decision | Outcome |
| --- | --- |
| Card content shape | Either `content` or `payload`, never both; `catalog` is the only discriminator, so the payload carries no `kind`; nothing is mirrored between the two, so `content` is optional. See [Contract Shape](#contract-shape). |
| Bare-URL signing cards | Not accepted. Reported and ignored rather than half-rendered through a second code path. Supersedes the original compatibility requirement. |
| Payload key name | `payload`, and only `payload`. The `signLanguage` alias two producers had landed with was accepted for part of a day and then withdrawn: it was folded in on the resolution path but not the enumeration path, so an aliased card rendered its video while reporting that no signed alternate existed. `pie-elements-ng` and the `pie-api-aws` importer now emit `payload` too, on branches that land with this one. |
| Non-tool feature decisions | A feature id is sufficient — no non-tool feature concept is needed. `ToolPolicyEngine.decideFeature(featureId)` and `ToolkitCoordinator.decideFeaturePolicy(featureId)` resolve one id through `PnpPolicySource`'s existing precedence, independent of placement, and `PnpPolicySource.resolveFeature(...)` reuses that rule evaluation rather than copying it. Answers an Open Question below. |
| Video sizing | An aspect-ratio target with a height floor, not a flat width percentage, retunable through three `--pie-section-player-item-media-*` theme tokens — the token prefix still says `item-media` though the surface was renamed `content-media`. The region stacks and the divider withdraws below a 560px *card* width, measured by `ResizeObserver` on the split container rather than a CSS media query, so a narrow card in a wide viewport stacks too. |
| Fragment enforcement, and what it does not reach | The out point is enforced by the player, not left to the browser: `enforceMediaFragment` seeks forward after `loadedmetadata` and pauses at the end via `timeupdate` plus a 100 ms poll. What the *type* allows and the shipped region does not reach is one recording serving several nodes — resolution returns a single card per owner scope, so the multi-node case in the payload comment and the QTI mapping table is a model capability, not shipped behavior. Read those two mentions as forward-looking. |
| Owner-scope agreement | `AccessibilityCatalogResolver.registerOwner(...)` owns the entity walk and transaction; `forOwner(...)` owns scoped reads and observation. The region receives only the resulting immutable snapshot, so it cannot reconstruct a scope registration never wrote. Direct lookup clients use `catalogOwnerContextFor(...)`. |
| Recorded audio as a spoken alternate | Built. QTI treats a recording and synthesized speech as the same `spoken` support, so this is another form of an existing accommodation and needs no new PNP entitlement. `SpokenAudioCardPayload` carries a `MediaAssetRef` of `kind: "audio"` plus an optional range. Highlighting is the docked node as a block, since a recording emits no word boundaries; word-level highlighting stays on the synthesized path. A clip that will not play degrades to the node's `content` card — the reason QTI's guidance keeps the script beside the audio. Supersedes the earlier open question, which held off pending a decision about timing marks; marks turned out not to be a prerequisite. |
| Script and recording on one node | Both are `spoken` cards in the same language, distinguished only by which slot each fills, so no new field and no second discriminant. `CatalogLookupOptions.form` selects one, as a preference rather than a filter, within a language rung and never across one — otherwise a Spanish lookup could be answered with English audio. Before this, both resolution rungs and enumeration keyed on type and language alone, so whichever card was written second was unreachable and nothing said so. |
| Unknown catalog types | `CatalogType` stays open — QTI's vocabulary is extensible and catalogs arrive as authored JSON — but unknown tokens are reported once per token, on the card side and the lookup side. `isKnownCatalogType` accepts the named types plus QTI's `ext:` extensions. `transcript` joined the named set because the Learnosity importer emits it, and a validator that warns on ordinary imported content trains people past the warning that mattered. Supersedes the earlier open question about narrowing the type: the silence was the defect, not the openness. |
| `signLang` versus card `language` | `signLang` is optional (2026-08-09); the card's `language` is the field resolution selects on, and the two coincide on almost every card. Resolution runs before anything knows the card is a signing card, so it can only key on the generic field; `signLang` is read afterwards, for the region's accessible label and the no-cross-sign-language guard, falling back to the card's `language` when absent. It earns its place only where the two differ — a card tagged with the item's content language (`language: "en-US"`, `signLang: "ase"`) so resolution reaches it by the default-language rung. It was typed required while the code had always treated it as optional. All three repos now state the language once, on the card: the Learnosity importer emits `language` alone, and `pie-elements-ng`'s `isSignLanguageCard` no longer demands a `signLang` it would have rejected every imported card for. |
| Signing suppression | No signing equivalent of `data-tts-suppress`, and none should be added. Whether a clip gives a decoding item away depends on fingerspelling versus lexical signing — a fact about the recording, known to the signer rather than to whoever authors an attribute. And suppression is per node while a signed alternate is one video per item, so the only available rule would withhold a deaf candidate's whole translation over one word. Unlike TTS, which speaks whatever text is present with nobody in the loop, a signed alternate does not exist until a signer films it. Revisit only if per-node signing docking lands *and* a programme authors signing for decoding-construct items. |
| Read-aloud suppression | Built as `data-tts-suppress` on the content element — not a catalog card, not a PNP field. Corrects an earlier reading of this document, which put QTI's reading-type vocabulary out of scope wholesale: QTI has a purpose-built attribute for exactly this (`data-qti-suppress-tts`, same vocabulary and placement), so PIE was not honouring a standard. The name follows PIE's `data-tts-*` family; importers map QTI's spelling. What stays out is reading-type as delivery policy — who may read a node aloud is the PNP's job, and a second authority on the card could contradict it. See the [integration guide](../accessibility/accessibility-catalogs-integration-guide.md#suppressing-read-aloud). |
| Inline signing markup | No render-time lift, decided 2026-08-09. A `sign-language` card is authored or written by an importer, full stop. A `SignLanguageExtractor` mirroring `SSMLExtractor` was built and removed: nothing produced the inline form (the Learnosity transform writes `accessibilityCatalogs` directly, and no legacy PIE content carries signing video inline), and it failed in the wrong direction — a runtime without `DOMParser`, or one that hit a parse error, left the video in the visible content and showed the accommodation to every learner regardless of eligibility. Its synthesized catalog ids were positional as well, so inserting a region renumbered the `data-catalog-idref` docking another one. `SSMLExtractor` is not a precedent: inline `<speak>` is real authored content PIE does not control. Qualifies the `SSMLExtractor` parallel drawn in [What ASL Is, In PIE Terms](#what-asl-is-in-pie-terms): the catalog rail is shared, the extraction step is not. |
| Shared card structure | Partly done. No third copy was written: the media region is one shared component (`SectionCardMediaSplit`) that both `SectionItemCard.svelte` and `SectionPassageCard.svelte` render. Their surrounding header/content/footer duplication remains, and a token-documentation test asserts the card tokens appear in both files, so factoring *that* together is still its own change. Qualifies the suggestion in [Region Presentation](#region-presentation). |

## Open Questions

- **International sign-language variants.** A future consideration, separate from Signed English: ASL, British Sign Language, and French Sign Language are not interchangeable, and international rollout would need separately authored content per variant. The language-tagged-card mechanism already generalizes to this at no extra engineering cost — same as the resolved multi-signed-language capability above — so nothing needs to be built differently now. Recorded so the framework isn't later assumed to be ASL-only by accident; not a near-term requirement.
- **Presentation parameter vocabulary.** [Region Presentation](#region-presentation) settles the first iteration's layout, but not the names of the parameters a later configurable version would take. The seam is `toolParameters`; the vocabulary is new and PIE-local, since AfA has no signing-layout token. Deferred with the generalization itself — there is no point naming parameters for a configurability that is not being built yet.
- **Video sizing numbers.** The *mechanism* is settled (aspect-ratio target plus height floor, exposed as theme tokens — see Resolved Decisions). The numbers are not: they were chosen against a stand-in clip rather than footage authored to sign these prompts. The import transform was proved end-to-end on 2026-08-10 against a real item, but that item cannot live in any repository, so it did not supply a clip this repo can check sizing against — this question is still open pending a redistributable real ASL clip.
- Should PIE surface *coverage* — which content has signing available — so a learner is not left guessing? Low stakes while signing is one-per-item; matters if per-node docking lands.
- How does signing interact with the line reader, highlighter, and other capabilities that own the same content nodes?
- Does accommodation-usage telemetry belong in the instrumentation stream, and if so what is emitted without recording accommodation status as learner data?
