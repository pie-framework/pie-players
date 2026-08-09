# Sign Language (ASL) Support

Status: Draft

Owner: PIE Players maintainers

Tracking: unlike the timed-media workstream, this one **is** tracked. Tickets belong under epic [PIE-801](https://illuminate.atlassian.net/browse/PIE-801) (parent initiative [REN-103](https://illuminate.atlassian.net/browse/REN-103)). This PRD is the contract; PIE-801 is the delivery record. Three stories were opened 2026-08-07, spanning the three repos the feature crosses:

| Story | Repo | Scope |
| --- | --- | --- |
| [PIE-879](https://illuminate.atlassian.net/browse/PIE-879) | `pie-elements-ng` | Verify the dormant `accessibilityCatalogs` model carries sign-language cards. |
| [PIE-880](https://illuminate.atlassian.net/browse/PIE-880) | `pie-players` | Extract, resolve, and render `sign-language` cards in a section-player region. Depends on PIE-879 for the payload shape. |
| [PIE-881](https://illuminate.atlassian.net/browse/PIE-881) | `pie-api-aws` | Carry ASL video through the Learnosity→PIE import transform; end-to-end proof using real ASL item samples. |

PIE-881 is the integration proof for all three. The pipeline is Learnosity source → `pie-api-aws` transform → PIE item `accessibilityCatalogs` → `pie-players` render; a story landing in isolation proves nothing until that path runs end to end.

**Implementation status, 2026-08-08.** PIE-880 is implemented on `feat/PIE-880`: extraction, resolution, the per-item media region, and `signLanguage` policy gating, with the payload contract in `players-shared`. Decisions taken while building it are recorded in [Resolved Decisions](#resolved-decisions), and where they supersede an earlier line in this PRD, that line says so rather than being quietly rewritten. Nothing renders end to end yet: no signed clip is bundled (PIE does not own ASL video production), so the demo ships a poster and PIE-881 supplies the first real footage.

[PIE-882](https://illuminate.atlassian.net/browse/PIE-882) runs ahead of all three: it retires `@pie-element/core`, a dead `pie-elements-ng` package whose stale copy of the type model made a single canonical `accessibilityCatalogs` definition look like two competing ones. Not ASL work and not a code dependency — sequenced first so this work targets one unambiguous type home.

Naming: the epic currently says "Video Support (e.g. ASL)". That should be renamed to "ASL support" — the work is catalog/PNP/accommodation-shaped, not video-player-shaped. See [Relationship To Section-Player And To Timed Media](#relationship-to-section-player-and-to-timed-media). Signed English (`eng-US`) rides the same card type, so a video-centric name obscures that too.

**Direction, pending a technical prototype and UX check.** These are the maintainers' current engineering direction, not yet finalized against a working prototype:

- **Link video to the existing item id; do not clone a separate ASL item.** Resolves [The Import Invariant](#the-import-invariant) below toward "merge," chosen for scalability and lower technical debt over the simpler clone-based path. Pending a prototype.
- **Default the video's own audio off.** Which audio channel this applies to — a track on the signing video itself, versus the item's own narration when both are present — needs to be confirmed precisely during prototyping rather than assumed. Related to, but not the same decision as, the [TTS-versus-signing coordination](#resolved-decisions) rule below.
- **Keep the framework generic, not ASL-specific.** Corroborates this PRD's existing catalog/`MediaAssetRef` reuse rather than changing it.
- **Authoring tooling is explicitly deferred.** Ship rendering now; hold off on any UI for authoring cue/catalog data until a concrete use case exists. Reinforces the existing Non-Goal below rather than changing it.
- **Presentation is settled for the first iteration** — fixed right-side split, resizable, no orientation options. See [Region Presentation](#region-presentation).

This section will go stale fast — check it against the current state of the prototype before treating any bullet above as final.

Related architecture:

- [Accessibility Catalogs Quick Start](../accessibility/accessibility-catalogs-quick-start.md)
- [Accessibility Catalogs Integration Guide](../accessibility/accessibility-catalogs-integration-guide.md)
- [Media asset contract](./shared-contracts/media-asset-contract.md)
- [Accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md)
- [Timed media section architecture](../architecture/timed-media-section.md) — related media work, but a different mechanism; see [Relationship To Section-Player And To Timed Media](#relationship-to-section-player-and-to-timed-media)

## Problem

Deaf and hard-of-hearing learners need item language delivered in sign language. PIE has the vocabulary for this and none of the behavior:

- `CatalogType` in `AccessibilityCatalogResolver` already listed `"sign-language"`, but before this work nothing rendered it: the only consumer of `getAlternative()` was `TTSService`, for `spoken`. Section-player now calls it for `sign-language` too — see the implementation note above.
- `QTI_STANDARD_ACCESS_FEATURES` already lists `signLanguage`, `signLanguageInterpretation`, and `visualLanguage`, and the `deafHardOfHearing` example profile lists `signLanguage` and `visualLanguage` (not `signLanguageInterpretation`) — but no tool declares those `pnpSupportIds`, so no PNP support activates anything.
- `CatalogCard.content` is a flat `string`. A signing video needs more than one URL.

The gap is visible in real content. Learnosity items in the ETL playground carry ASL video and render it in the Learnosity view; the PIE view of the same item shows the multiple-choice question with no video, because nothing translates that content into a PIE-renderable alternate representation.

### What ASL Is, In PIE Terms

Four domain facts drive this contract. Getting them wrong produces the wrong architecture, and most of them contradict a plausible first guess.

1. **ASL video translates the prompt, not the passage.** Learnosity's "stimulus" field corresponds to what PIE calls **prompt** — not to what PIE calls **passage**. The signing video is a translation of the prompt into another language. It is not shared context framing several items, so it is not passage-shaped and not section-shaped.

2. **ASL coexists with written English; it does not replace it.** Spanish translation in Renaissance practice produces a different item (a different id, not just a different content version), all in Spanish with no English. ASL cannot work that way, in significant part because ASL is not written down in everyday practice — transcription systems exist but are of theoretical interest rather than part of most signers' linguistic practice. Deaf learners in the US typically use ASL for real-time communication and English for reading and writing, often with very different fluency in each, and in either direction depending on whether deafness was congenital. So the ASL video must sit **alongside** the English content in the same item, as an alternate representation, not as a translated sibling item.

3. **Language-bearing content beyond the prompt may also need signing.** Answer choices expressed as language plausibly need signed translations too. Choices expressed as images do not. Granularity therefore has to reach below the item — the card model must stay per-content-node capable even though today's content does not exercise it. The sample items are one video per item, and their choices are images, so per-node docking is a future capability rather than an MVP concern.

4. **It is an accommodation in PIE, and that is a deliberate divergence from the source.** Authoring and content — effectively the video links — are item-level, roughly 1-1 with items, and content authors treat ASL-supported items as dedicated items even where they are engineering copies. But *when and how* the video is exposed is a toolkit decision through catalogs and policy. That makes it an accommodation both technically and logically: the video adds no assessed content, measures the same construct the same way, and merely presents it in another language. That is what separates an accommodation from a different item, and it is why Spanish needs a sibling item while ASL does not.

   Learnosity does not model it this way. Its content model splits into Questions and [Features](https://help.learnosity.com/hc/en-us/articles/16684575643549-feature-types) — non-scored components including Audio player, Passage, and Video player — so a signing video is ordinary item content and renders unconditionally, with nothing to gate. The ETL is therefore performing a semantic transformation, not a translation, and should be written knowing that.

This is why the accessibility catalog is the right rail: catalog cards attach to arbitrary content nodes through `data-catalog-idref`, they are additive to the English content rather than a substitute for it, and PIE already docks TTS this way. That parallel is the strongest evidence the model is right — authored `<speak>` SSML is item-level content that `SSMLExtractor` lifts into item catalogs and the toolkit plus policy decide whether to expose. Signing is the second instance of a shipped pattern, not a new one.

`CatalogOwnerKind` is already `"global" | "passage" | "itemModel"`, so passage-scoped signing cards are structurally supported without new plumbing.

### The Import Invariant

Because the source has two Learnosity items (a base and an ASL copy) while PIE wants one item carrying cards, the importer must either merge them or emit both. The invariant either choice must satisfy:

> The item a student receives must carry the cards that student's profile can use.

Merging satisfies this trivially. Emitting both satisfies it only if assembly and policy agree, and the failure mode is quiet: serve a "dedicated ASL item" to a student without the accommodation and gating hides the video, producing an ASL item that shows no ASL.

**Current direction, not yet final (see the callout above): merge.** Link the signing video to the existing item id rather than cloning a separate ASL item, chosen for scalability over a simpler clone-based path that would have covered a narrower near-term delivery target. The ETL itself still lives outside `pie-players` and isn't scoped here, but the importer should target this direction rather than treating the choice as open.

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
- No decision here on whether the video player component is shared with `video-stimulus`; see Open Questions.

## Package And Export Ownership

- Owning package for resolution and policy: `@pie-players/pie-assessment-toolkit` (source at `packages/assessment-toolkit`). It already owns `AccessibilityCatalogResolver`, the PNP feature vocabulary, and `ToolPolicyEngine`.
- Owning package for data types: `@pie-players/pie-players-shared` (source at `packages/players-shared`), where `CatalogCard`, `AccessibilityCatalog`, and `PersonalNeedsProfile` already live.
- Runtime host: `@pie-players/section-player`, same as spoken/TTS catalogs today. Section-player consumes `assessment-toolkit` (which owns the catalog resolver and PNP policy), so no new host is introduced — only a new catalog card type and a new renderer for it.
- Rendering placement: **a per-item region in `SectionItemCard.svelte`**, alongside the `header` and `content` regions it already declares — decided 2026-08-07. Not a toolbar surface, and not an item-player affordance. `item-player` needs to know nothing about signing.
- Policy identity: **signing takes a feature id and registers for policy**, so it inherits the six-level precedence in `PnpPolicySource` (`district-block`, `test-admin-override`, `item-restriction`, `item-requirement`, `district-requirement`, `pnp-support`, `pnp-prohibited`). Policy identity and rendering placement are deliberately separated here; see [What Counts As A Tool](../tools-and-accomodations/architecture.md#what-counts-as-a-tool).
- Public export path: open question; expected to be additive exports from the two owners above plus the region and its registration.
- Consuming packages or apps: `section-player`, `assessment-toolkit` registry and policy engine, demo apps, `pie-elements-ng` only if per-node docking below the prompt is later scoped, and `pie-qti` adapters.
- Runtime environment: browser and custom element; data types must stay Node-safe for importers and adapters.

### Why A Region Rather Than A Tool Surface

Two things were being coupled that should not be. The card's `data-catalog-idref` says **what** the video translates; the layout says **where** it appears. With one signing video per item — which is what the content actually has — the region does not need to sit adjacent to a specific DOM node, so placement becomes a layout concern and presentation stays policy-driven rather than hard-coded.

This also keeps the platform from limiting presentation. Because signing has a feature id, its availability *and* its presentation parameters can be set at host, district, test-administration, item, and student level through machinery that already exists — `settings.districtPolicy`, `settings.testAdministration`, `currentItemRef.settings.toolParameters`, and `personalNeedsProfile`. Only the parameter vocabulary is new; the seam is not.

**Per-item, not section-wide.** An earlier draft of this line said "the way the passage shell has one," which was underspecified in a way worth correcting: a passage sits *once* beside a column of items because a passage is genuinely shared across them. Signing is 1-to-1 with items, so a passage-shaped region would be the wrong shape. The region belongs in `SectionItemCard.svelte`, which already renders per item and already declares `data-region` slots.

**Name the region generically, not `asl`.** The thing filling the slot is a resolved catalog card, which is already a generic mechanism, and the most plausible second occupant is a near neighbor on the same rail rather than a hypothetical — audio description is the same "docked alternate media, gated by PNP" shape. Naming the slot after its first tenant would force a rename for no present saving, since the component and CSS are identical either way. Low-stakes and reversible if a second consumer never appears.

### Region Presentation

Decided 2026-08-07, and deliberately minimal for the first iteration:

- **Fixed default: to the right of item content.** Two reasons, and the second is the decisive one. Text-first sequencing argues for the item anchoring the primary/left position in an LTR reading flow. More importantly, a bottom placement imposes a scroll-away cost: signing is re-checked *while* forming an answer, not read once beforehand, so a video below the content means scrolling down to the video and back up to the choices, repeatedly. A side-by-side split keeps both visible regardless of item length. Being parallel rather than sequential, it also sidesteps a problem an above/below split cannot solve — `item-player` renders prompt and choices as one opaque block, so there is no way to place the video "after the prompt, before the choices" without breaking the boundary that keeps `item-player` ignorant of signing.
- **Resizable, following the existing divider pattern.** `SectionSplitDivider.svelte` is the prior art: pointer-based, keyboard-accessible, `role="separator"`, percentage-bounded. Reuse its shape rather than inventing a second resize interaction. Note it is currently coupled to the passage/items grid and hardcoded to one orientation, so this is "follow the pattern," not "import the component."
- **No configurable orientation and no free drag-to-reposition in the first iteration.** Free 2D repositioning is the `ItemToolBar` floating-window pattern, built for movable utility windows like the calculator; dragging a signing video to an arbitrary spot over item content is more affordance than the accessibility need calls for. Build the four-orientation, policy-gated generalization only once there is a signal it is needed — the `toolParameters` seam is already the right place to hang it, but nothing hangs there yet. There is also no layout-related policy surface today: `SectionPlayerPolicies` covers only readiness, preload, and telemetry.

Worth folding in while touching this: `SectionItemCard.svelte` and `SectionPassageCard.svelte` already hand-duplicate the same header/content/footer structure. Adding a media region is a reasonable moment to factor that into one shared shape rather than writing a third copy.

## Contract Shape

Final names are not ratified by this draft. Two changes are needed: a card payload that can describe video, and a resolution/render path that consumes it.

```ts
// Documentation sketch only.

// Today: `CatalogCard.content` is a flat string, which forces a bare URL.
// Proposed: keep `content` for text-ish catalogs and add a typed media payload.
interface SignLanguageCardPayload {
  /**
   * ISO 639-3 sign language code. "ase" = ASL, matching QTI 3 `xml:lang`.
   * This is the LANGUAGE OF THE ADAPTATION, not the item's base content
   * language — AfA/PNP's `languageOfAdaptation` distinction, and a real one:
   * a Spanish item's signed alternate is LSM, not ASL, so `signLang` must
   * never be inferred from the item/assessment content language. Decided
   * 2026-08-07; see Open Questions for the still-open per-student/per-content
   * selection rule when more than one signed language is authored.
   */
  signLang: string;
  /** Reuses the shared media contract rather than inventing media fields here. */
  media: MediaAssetRef;
  /**
   * Optional time slice of a longer signing video, so one recording can serve
   * several content nodes. Mirrors QTI 3's Media Fragments URI usage.
   */
  fragment?: { startSeconds: number; endSeconds?: number };
}

type CatalogCardPayload = SignLanguageCardPayload;

interface CatalogCard {
  catalog: string;    // QTI's `qti-card@support` — the only discriminator
  language?: string;
  content?: string;   // the string form; absent on cards that have none
  payload?: CatalogCardPayload;  // the structured form, read according to `catalog`
}
```

**Either `content` or `payload`, never both — decided 2026-08-08 during PIE-880,
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

One integration consequence, resolved 2026-08-08, then re-resolved the same day.
Two landed producers — `pie-elements-ng` (PIE-879) and the `pie-api-aws`
Learnosity importer (PIE-881) — carried the media block under `signLanguage`,
while this repo read only `payload`, so an imported or element-authored card
resolved to nothing: it validates, it imports, and then no signing video renders.
The first repair accepted `signLanguage` as an input alias, folded into `payload`
where the resolver projects a card.

That repair was withdrawn, because it caused a worse version of the same bug.
The fold-in was on the resolution path only; `getAllAlternatives` read `payload`
alone, so a card that arrived under the alias rendered its signing video *and*
answered "no" to `hasAlternativeType(..., "sign-language")`. The accommodation
worked and anything asking whether it existed was told it did not — invisible to
everyone except the learner. One fact under two names makes every read path a
place to forget one of them, and the first new read path forgot.

Both producers now emit `payload`, so the alias has nothing left to accept and is
gone from the type, from `resolveCard`, and from `resolveSignLanguageMedia`. All
three repos declare one card shape: a single generic `payload` slot interpreted
by `catalog`, which is what QTI's one-content-slot `qti-card` describes and what
keeps braille — the next structured alternate — additive rather than a breaking
widening in three places. `resolveSignLanguageMedia` now warns on *any*
`sign-language` card it cannot resolve, so a card left over from the old spelling
says so instead of silently resolving to nothing.

The three changes must land together: a host shipping this player against content
built by the older element types or the older importer will see signing cards
stop resolving, with that warning as the signal.

`MediaAssetRef` is reused deliberately rather than defining media fields here — decided 2026-08-07 — to avoid two media vocabularies in one codebase. Two consequences the accepted contract must carry:

- Optionality is resolved per consumer, not by making every field optional at the type level (which would stop the type catching anything). This answers an open question already posed in the media asset contract. For signing: sources and language are required; poster and duration are not applicable.
- `tracks` and `transcript` are not merely optional here, they are **meaningless**. Captions on a signing video would be the English text already on screen. Stated explicitly so no future policy adds a caption requirement to signing media.

Resolution and gating reuse existing seams:

- lookup stays `AccessibilityCatalogResolver.getAlternative(catalogId, { type: "sign-language", language })`, with the existing `scoped → item → assessment` priority and `CatalogOwnerContext`;
- docking stays `data-catalog-idref` on the content node, the same attribute `SSMLExtractor` writes and `TTSService` reads;
- eligibility comes from `PnpPolicySource`, at any of its six precedence levels — not from the student profile alone.

### Availability Rule

Signing is available when **both** conditions hold: the content carries a matching `sign-language` card, and policy grants eligibility. Both are required, and they are checked independently.

This is deliberately not framed as "default on versus default off." The content condition is the DRD half of AfA's matching pair (see [What Counts As A Tool](../tools-and-accomodations/architecture.md#what-counts-as-a-tool)), and it is what prevents a dead affordance on the overwhelming majority of items that carry no signing video — regardless of what the computed default profile happens to say. The eligibility half follows the accommodation tier: not granted by default, because signing requires a documented need.

One consequence worth stating for implementation: signing takes a feature id, so it is picked up by `computeDefaultSupports()` and would enter `DEFAULT_PERSONAL_NEEDS_PROFILE` unless deliberately excluded. Exclude it. Hosts that supply their own profile are unaffected either way.

Validation: `sign-language` cards need indexing and validation distinct from text cards, since a malformed media payload must not silently degrade to an empty string or render a URL as visible text.

## Compatibility

This PRD touches these surfaces:

- **Contract attributes.** It adds a second consumer of `data-catalog-idref`. TTS behavior through that attribute must not change; the attribute stays one canonical name with two readers.
- **Persisted/authored wire data.** `CatalogCard` gains a payload shape. Existing `{ catalog, language?, content }` cards keep resolving unchanged, and `content` is where every text-ish type still lives. Revised 2026-08-08: an earlier version of this bullet also required `sign-language` cards carrying a bare URL in `content` to keep working as a legacy single-source form. That requirement is dropped — no producer writes that shape, and accepting it would mean a second code path and a second source of truth for the same URL while silently discarding the MIME type, label, and any second source. Such a card is now reported and ignored.
- **Default PNP.** `DEFAULT_PERSONAL_NEEDS_PROFILE` is *computed* from the packaged tool registry by `computeDefaultSupports()`. Registering a signing tool with `pnpSupportIds: ["signLanguage"]` would therefore widen the default profile for every host that does not supply its own. Decided 2026-08-08: signing must be explicitly opted into. `signLanguage` is listed in `ACCOMMODATION_ONLY_SUPPORT_IDS` and filtered out of that computation by id — not by declining to register the tool, so the guarantee survives however a signing tool later reaches the registry.
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

Catalog data is authored and wire-facing. The accepted PRD must define:

- a version marker on the sign-language card payload, or an explicit statement that `CatalogCard` versioning is inherited from the enclosing assessment/item content version;
- validation ownership in `players-shared` or `assessment-toolkit`, consistent with wherever `CatalogCard` validation lands;
- unknown-`catalog`-type behavior: unknown types are already tolerated by `CatalogType`'s `| string` tail and must continue to be ignored rather than rejected;
- unknown-payload-shape behavior: a `sign-language` card whose payload does not validate must be treated as absent, and must not be rendered as raw text;
- fixtures for single-source, multi-source, poster, fragment-range and missing-language cards, plus the two rejected shapes (bare-URL `content`, and a payload with no usable source).

## Accessibility

This PRD is accessibility-scoped. It consumes [accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md).

Standards framing matters here: WCAG 2.2 covers sign language only at SC 1.2.6 (Sign Language, prerecorded), which is **Level AAA** and scoped to prerecorded audio in synchronized media. Signing a text prompt is not a WCAG AA obligation at all. ASL support in PIE is therefore driven by assessment accommodation policy and 1EdTech's Elevated Accessibility expectations, not by the repo's WCAG 2.2 AA baseline. Do not justify it as an AA requirement, and do not treat AA conformance as evidence that signing is covered.

Requirements:

- the signing affordance is keyboard reachable and labelled, and its label names the language (for example "American Sign Language") rather than a generic "video";
- opening and closing signing playback moves focus predictably and restores it on dismiss;
- signing playback and TTS must not run simultaneously; the accepted PRD defines which yields;
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
| `qti-card-entry xml:lang="ase"` | card language / `signLang` | ISO 639-3; `ase` is ASL. |
| `qti-html-content` with `<video>` and multiple `<source>` | `SignLanguageCardPayload.media` | Today's flat `content: string` cannot carry this. |
| Media Fragments URI on the source | `fragment` | QTI 3 replaced APIP's separate start/end cue elements with fragment notation, letting one recording serve several nodes. |
| `data-catalog-idref` docking, conventionally on a hidden docking div | `data-catalog-idref` | Already the same attribute PIE uses for TTS. |
| APIP `signFileASL` / `signFileSignedEnglish` | catalog card + language | APIP's two sign types collapse into card language. Signed English is scoped out for MVP; see Open Questions. |
| PNP 3.0 / AfA `signLanguage` | `PersonalNeedsProfile.supports` | Vocabulary already present in `pnp-standard-features.ts`. |

The table covers signing. It is not a survey of the catalog model, and two places where PIE's shape and the standard's diverge are recorded as open questions below rather than as mappings: QTI's `spoken` card may carry a pre-recorded audio file rather than SSML, and `ext:`-prefixed vendor support tokens have nowhere to land in a closed `CatalogType`. Neither is a defect in this design — nothing here promised to represent them — but both would surface the day something actually reads QTI, so they are written down while the reasoning is fresh.

Import/export mapping, if it is ever built, belongs in `pie-qti` and is where any lossy transform gets documented — in particular whether the hidden-docking-div convention survives a PIE round trip.

## Relationship To Section-Player And To Timed Media

**Section-player is the runtime host** for signing, and there is nothing new about that: the accessibility catalog resolver lives in `assessment-toolkit`, which section-player consumes, and section-player already renders `spoken` catalog cards through the same path that this PRD extends. Signing is a new *type* of catalog card and a new *renderer*, not a new host.

What this PRD is *not* is a new section flavor. [Timed media](./timed-media-section-contract.md) is a section flavor — it introduces `sectionType: "timed-media"`, cue orchestration, and a specialized layout custom element — because it composes multiple items around a shared timeline. Signing does none of that: many short recordings, each translating one content node, played on learner demand, gating nothing.

An earlier intuition was to model ASL as a passage and build a specialized ASL section layout. That framing is rejected by facts 1 and 2 above: the video translates a prompt rather than framing multiple items, and it must coexist with the English content inside the same item. The rejection is about *modeling ASL as a passage*, not about section-player involvement.

| | Timed media | Sign language |
| --- | --- | --- |
| Runtime host | Section-player (timed-media variant) | Section-player (existing catalog rail) |
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
- a regression test pinning that `signLanguage` stays out of `computeDefaultSupports()` however a signing tool is registered;
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

- Changeset required: yes. This adds public exports and a section-player region under the lockstep versioning policy.
- Migration notes: additive for authored content — existing `spoken`, `braille` and other string-form catalogs keep working untouched. Not additive at the type level: `CatalogCard.content` and `ResolvedCatalog.content` became optional (see [Contract Shape](#contract-shape)), so a consumer that reads `.content` as a `string` needs a guard. Hosts supplying their own `PersonalNeedsProfile` see no behavior change until they grant signing eligibility.
- Documentation updates: accessibility catalog quick start and integration guide, tools-and-accommodations docs, the PNP debugger tool docs, and `pie-qti` adapter PRDs.
- Release risk: medium-high. The runtime surface is small, but it is an accommodation — a silent failure means a learner cannot read the item at all, and the failure mode is invisible to hosts that do not test with `signLanguage` granted.

## Resolved Decisions

Settled in review 2026-08-07 and inlined into the sections above rather than left as questions:

| Decision | Outcome |
| --- | --- |
| Accommodation or item content? | Accommodation. Item-level authoring, toolkit-controlled exposure. Deliberate divergence from Learnosity's Feature model. |
| Rendering placement | A per-item region in `SectionItemCard.svelte`, beside its existing `header`/`content` regions. Not section-wide like the passage shell, not a toolbar surface, not an item-player affordance. |
| Region presentation | Fixed default to the right of item content, resizable via the `SectionSplitDivider.svelte` pattern. No configurable orientation and no free drag in the first iteration. See [Region Presentation](#region-presentation). |
| Region naming | Generic (media/catalog-media), not ASL-specific — the slot holds a resolved catalog card, and audio description is the same shape. |
| Policy identity | Takes a feature id and registers for policy, inheriting the six-level precedence. Separate from rendering placement. |
| Presentation limits | None imposed by the platform. Driven by policy at host, district, test-administration, item, and student level via existing seams; only the parameter vocabulary is new. |
| Default availability | Requires a matching card *and* eligibility. Excluded from the computed default profile. |
| Media payload | Reuse `MediaAssetRef`; declare the required subset per consumer; `tracks`/`transcript` meaningless for signing. |
| Player component | Minimal `<video>` wrapper. Not shared with `video-stimulus` — the clips are seconds long, and a dependency on an unbuilt element buys nothing. |
| Per-choice docking | Real future capability, not an MVP concern. Sample content is one video per item with image choices. Card model stays per-node capable. |
| TTS versus signing | The action the learner just took wins; starting one pauses the other. |
| Signed English in scope? | Not needed for current (US) scope. Distinct from the international sign-language question below; don't conflate the two. |
| Multi-signed-language capability | Ships as part of the base design at no extra cost — same card-array-plus-`language` mechanism already used for multi-language spoken TTS, applied to a new catalog type rather than built new. Default to *no* cross-sign-language fallback (show nothing rather than silently substitute a different sign language a student may not follow); revisit only if real usage shows the strict default is wrong. |
| Item model, clone vs. link | Current direction, not yet final: link video to the existing item id rather than cloning. See [The Import Invariant](#the-import-invariant). |
| Default audio state | "Audio off by default" is the direction; confirm exactly which audio channel during prototyping — see the callout at the top of this PRD. |
| Authoring tooling | Explicitly deferred until a concrete use case exists. Ship rendering first. |

Settled during PIE-880 implementation, 2026-08-08:

| Decision | Outcome |
| --- | --- |
| Card content shape | Either `content` or `payload`, never both; `catalog` is the only discriminator, so the payload carries no `kind`; nothing is mirrored between the two, so `content` is optional. See [Contract Shape](#contract-shape). |
| Bare-URL signing cards | Not accepted. Reported and ignored rather than half-rendered through a second code path. Supersedes the original compatibility requirement. |
| Payload key name | `payload`, and only `payload`. The `signLanguage` alias two producers had landed with was accepted for part of a day and then withdrawn: it was folded in on the resolution path but not the enumeration path, so an aliased card rendered its video while reporting that no signed alternate existed. `pie-elements-ng` and the `pie-api-aws` importer now emit `payload` too, on branches that land with this one. |
| Non-tool feature decisions | A feature id is sufficient — no non-tool feature concept is needed. `ToolPolicyEngine.decideFeature(featureId)` and `ToolkitCoordinator.decideFeaturePolicy(featureId)` resolve one id through `PnpPolicySource`'s existing six levels, independent of placement, and `PnpPolicySource.resolveFeature(...)` reuses that rule evaluation rather than copying it. Answers an Open Question below. |
| Video sizing | An aspect-ratio target with a height floor, not a flat width percentage, retunable through three `--pie-section-player-item-media-*` theme tokens. The region stacks and the divider withdraws below a 560px card width. |
| Owner-scope agreement | One function decides where a catalog is filed and one builds the context readers look it up with (`collectEntityCatalogRegistrations`, `catalogOwnerContextFor`), so the region cannot look up a scope registration never wrote. |
| Recorded audio as a spoken alternate | **Built.** QTI treats a recording and synthesized speech as the same `spoken` support, referenced by file plus MIME type, so this is another form of an existing accommodation rather than a new one — and needs no new PNP entitlement, since a clip played by the player is still computer-delivered speech and the standard has no vocabulary distinguishing it from synthesis. `SpokenAudioCardPayload` carries a `MediaAssetRef` of `kind: "audio"` plus an optional range. Highlighting is the docked node as a block for the clip's duration: a recording emits no word boundaries, and timing them from its duration would highlight the wrong words confidently rather than the right region vaguely, so word-level highlighting stays on the synthesized path. A clip that will not play degrades to the node's `content` card, which is the concrete reason QTI's guidance keeps the script beside the audio; with no script authored the failure is reported rather than silently skipped. Supersedes the earlier open question, which recorded the shape but declined to build it pending a decision about timing marks — the decision was that marks are not a prerequisite. |
| Script and recording on one node | Both are `spoken` cards in the same language, distinguished only by which slot each fills, so no new field and no second discriminant. `CatalogLookupOptions.form` selects one; it is a preference rather than a filter, applied within a language rung and never across one, so a Spanish lookup is never answered with English audio in preference to Spanish text. Before this, both resolution rungs took the first card matching type and language and enumeration deduped on the same key, so whichever card was written second was unreachable and nothing said so. |
| Unknown catalog types | `CatalogType` stays open — QTI's support vocabulary is extensible and catalogs arrive as authored JSON — but unknown tokens are now reported once per token, on the card side and the lookup side. `isKnownCatalogType` accepts the named types plus QTI's `ext:` vendor extensions. `transcript` joined the named set because the Learnosity importer emits it, and a validator that warns on ordinary imported content trains people past the one warning that mattered. Supersedes the earlier open question about narrowing the type: narrowing would reject content PIE cannot usefully validate; the silence was the actual defect. |
| Signing suppression | **No signing equivalent of `data-tts-suppress`, and none should be added.** Read-aloud needs a machine-readable guard because a synthesizer speaks whatever text is present with no human in the loop; a signed alternate does not exist until a signer films it, so "do not give the answer away" is a decision a person is already making — the discipline `static/demo-assets/sign-language/README.md` already documents. Two things make a flag wrong rather than merely unnecessary: the deciding fact (does the clip fingerspell the target word, or sign it lexically?) lives in the recording and is known to the signer, not to whoever authors an attribute beside the prompt; and the granularities do not meet, since suppression is per node while a signed alternate is one video per item, so the only mechanically available rule would let one suppressed word withhold a deaf candidate's whole signed translation. Revisit only if per-node signing docking lands *and* a program authors signing for decoding-construct items — and even then, authoring review before a flag. |
| Read-aloud suppression | Built, as `data-tts-suppress` on the content element — not as a catalog card and not as a PNP field. Corrects an earlier reading of this document, which treated QTI's reading-type vocabulary as out of scope wholesale: QTI 3 has a purpose-built attribute for exactly this (`data-qti-suppress-tts`, same vocabulary, same placement), so PIE was simply not honouring a standard, and the name follows PIE's `data-tts-*` family with importers mapping QTI's spelling. What *stays* out is reading-type as delivery policy — who may read a node aloud is already resolved by the PNP, and a second authority on the card could disagree with it. Suppression is the one slice the PNP cannot express, because it is the item overriding an entitlement rather than a learner declining one. See the [integration guide](../accessibility/accessibility-catalogs-integration-guide.md#suppressing-read-aloud). |
| Shared card structure | **Not** done. `SectionItemCard.svelte` and `SectionPassageCard.svelte` still hand-duplicate header/content/footer; a token-documentation test asserts the card tokens appear in both files, so factoring them together is its own change. No third copy was written — the media region lives in the item card only. Supersedes the suggestion in [Region Presentation](#region-presentation). |

## Open Questions

- **International sign-language variants.** A future consideration, separate from Signed English: ASL, British Sign Language, and French Sign Language are not interchangeable, and international rollout would need separately authored content per variant. The language-tagged-card mechanism already generalizes to this at no extra engineering cost — same as the resolved multi-signed-language capability above — so nothing needs to be built differently now. Recorded so the framework isn't later assumed to be ASL-only by accident; not a near-term requirement.
- **Presentation parameter vocabulary.** [Region Presentation](#region-presentation) settles the first iteration's layout, but not the names of the parameters a later configurable version would take. The seam is `toolParameters`; the vocabulary is new and PIE-local, since AfA has no signing-layout token. Deferred with the generalization itself — there is no point naming parameters for a configurability that is not being built yet.
- **Video sizing numbers.** The *mechanism* is settled (aspect-ratio target plus height floor, exposed as theme tokens — see Resolved Decisions). The numbers are not: they were chosen without real ASL footage to look at, since none is bundled. Re-check the aspect ratio and the height floor against sample footage once PIE-881 supplies it.
- Should PIE surface *coverage* — which content has signing available — so a learner is not left guessing? Low stakes while signing is one-per-item; matters if per-node docking lands.
- How does signing interact with the line reader, highlighter, and other capabilities that own the same content nodes?
- Does accommodation-usage telemetry belong in the instrumentation stream, and if so what is emitted without recording accommodation status as learner data?
