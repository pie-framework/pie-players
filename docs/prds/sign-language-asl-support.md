# Sign Language (ASL) Support

Status: Accepted, 2026-08-15

Implementation status: shipped in pie-players as `@pie-players/pie-tool-sign-language`.
The pie-elements-ng card payload and the PIE API backend's Learnosity import are
complete, and the import path is proved in-repo against an unmodified import output.

Owner: PIE Players maintainers

This PRD defines how signed alternates of item and passage content reach learners: the
`sign-language` catalog card and its video payload, owner-scoped resolution,
`signLanguage` policy gating, and rendering on the `content-media` Content Surface. It
is for maintainers of the catalog, policy and tool-surface machinery and for producers
that write signing cards.

Naming: the feature is ASL support because the work is catalog-, PNP- and
accommodation-shaped. Signed English (`eng-US`) rides the same card type.

Related architecture:

- [Accessibility Catalogs Quick Start](../accessibility/accessibility-catalogs-quick-start.md)
- [Accessibility Catalogs Integration Guide](../accessibility/accessibility-catalogs-integration-guide.md)
- [Media asset contract](./shared-contracts/media-asset-contract.md)
- [Accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md)
- [Timed media section architecture](../architecture/timed-media-section.md): related media work with a different mechanism; see [Relationship To Section-Player And To Timed Media](#relationship-to-section-player-and-to-timed-media)

Integrator guide: [Opting in](../../packages/tool-sign-language/README.md#opting-in) in the `@pie-players/pie-tool-sign-language` README.

## Problem

Deaf and hard-of-hearing learners need item language delivered in sign language. PIE
had the vocabulary for this and none of the behavior:

- `CatalogType` in `AccessibilityCatalogResolver` listed `"sign-language"`, but nothing
  rendered it: the only consumer of `getAlternative()` was `TTSService`, for `spoken`.
- The toolkit's reference vocabulary listed `signLanguage`,
  `signLanguageInterpretation` and `visualLanguage`, but no tool declared those
  `pnpSupportIds`, so no PNP support activated anything.
- `CatalogCard.content` was a flat `string`, and a signing video needs more than one
  URL.

Imported Learnosity items carried ASL video and rendered it in the Learnosity view. The
PIE view of the same item showed the multiple-choice question with no video, because
nothing translated that content into a PIE-renderable alternate representation.

### What ASL Is, In PIE Terms

Four domain facts drive this contract.

1. **ASL video translates the prompt.** Learnosity's "stimulus" field corresponds to
   what PIE calls **prompt**, and the signing video translates the prompt into another
   language. It is not shared context framing several items, so it is neither
   passage-shaped nor section-shaped.

2. **ASL coexists with written English.** Spanish translation in current authoring
   practice produces a different item (a different id, not only a different content
   version), all in Spanish. ASL cannot work that way, largely because ASL is not
   written in everyday practice: transcription systems exist but are not part of most
   signers' linguistic practice.

   Deaf learners in the US typically use ASL for real-time communication and English
   for reading and writing, often with very different fluency in each, in either
   direction depending on whether deafness was congenital. The ASL video therefore sits
   **alongside** the English content in the same item, as an alternate representation.

3. **Language-bearing content beyond the prompt may also need signing.** Answer choices
   expressed as language plausibly need signed translations; choices expressed as
   images do not. The card model therefore stays per-content-node capable, although
   per-choice docking is out of scope (see [Non-Goals](#non-goals)).

4. **It is an accommodation in PIE, a deliberate divergence from the source.** Authoring
   and content (effectively the video links) are item-level, roughly 1-1 with items,
   and content authors treat ASL-supported items as dedicated items even where they are
   engineering copies. *When and how* the video is exposed is a toolkit decision
   through catalogs and policy. The video adds no assessed content, measures the same
   construct the same way, and presents it in another language. That is what separates
   an accommodation from a different item, and it is why Spanish needs a sibling item
   while ASL does not.

   Learnosity models it differently. Its content model splits into Questions and
   [Features](https://help.learnosity.com/hc/en-us/articles/16684575643549-feature-types),
   non-scored components including Audio player, Passage and Video player, so a signing
   video is ordinary item content that renders unconditionally, with nothing to gate.
   The import therefore performs a semantic transformation.

The accessibility catalog is the rail for this. Catalog cards attach to arbitrary
content nodes through `data-catalog-idref`, they are additive to the English content,
and PIE already docks TTS this way: authored `<speak>` SSML is item-level content that
`SSMLExtractor` lifts into item catalogs, and the toolkit plus policy decide whether to
expose it. Signing is the second instance of that pattern. The rail is shared and the
extraction step is not; see [Card Sources](#card-sources).

A catalog owner's `ownerKind` is `"global" | "passage" | "itemModel"`, so
passage-scoped signing cards need no new plumbing.

### The Import Invariant

The source has two Learnosity items (a base and an ASL copy), while PIE wants one item
carrying cards, so an importer either merges them or emits both. Either choice must
satisfy:

> The item a student receives must carry the cards that student's profile can use.

The import merges: it links the signing video to the existing item id and files the
card against that item, for scalability and lower technical debt than a clone-based
path. Emitting both satisfies the invariant only if assembly and policy agree, and its
failure is quiet: a "dedicated ASL item" served to a student without the accommodation
has its video hidden by gating, an ASL item that shows no ASL.

## Goals

- Render `sign-language` catalog cards as a learner-facing alternate representation,
  docked to content nodes through the existing `data-catalog-idref` mechanism.
- Support prompt-level granularity, with a path to choice-level and other
  language-bearing nodes.
- Define a catalog card payload for signing video that carries multiple sources, MIME
  types, poster and an optional time range.
- Gate availability on PNP (`signLanguage`) through the existing `ToolPolicyEngine` /
  `PnpPolicySource` path.
- Define coordination rules so signing playback, TTS and other media do not compete.
- Follow the QTI 3 catalog model where it fits, so the shape stays recognizable and a
  future adapter has something to map. QTI 3 is inspiration: no interoperability or
  conformance commitment is made, and where the standard and PIE's needs diverge, PIE's
  needs win.

## Non-Goals

- No cue-driven orchestration. Revealing, gating, pausing or sequencing items from media
  time is [timed media](./timed-media-section-contract.md), a different contract.
- No separate translated item variant for ASL (fact 2).
- No ASL video production, storage, CDN, signed URLs or retention. Host-owned.
- No synthetic signing, signing avatars or machine translation.
- No Learnosity→PIE import implementation. The import lives outside pie-players; this
  PRD defines the PIE-side target shape an importer writes into.
- No authoring UI for catalog data until a concrete use case exists. Rendering ships
  first.
- No QTI conformance claim. Mapping belongs in `pie-qti`.
- No video player component shared with `video-stimulus`. The clips are seconds long,
  so a minimal native `<video>` wrapper is enough, and a dependency on an unbuilt
  element buys nothing.
- No per-choice docking. The product requirement is one video per question, and the
  sample content is one video per item with image choices; fact 3 still holds for
  language-bearing choices. What keeps it reachable costs nothing to maintain: the card
  model stays per-content-node capable, `data-catalog-idref` stays author-owned and
  byte-for-byte, and resolution takes the first card for the scope without assuming one
  exists. Reopening it is additive: `data-catalog-idref` on choice nodes from
  pie-elements-ng, and a resolver that returns more than one card per scope.

## Package And Export Ownership

- Generic machinery: `@pie-players/pie-assessment-toolkit` (`packages/assessment-toolkit`)
  owns `AccessibilityCatalogResolver`, the PNP feature vocabulary, `ToolPolicyEngine`
  and the registration contract, and names no capability.
- Signing: `@pie-players/pie-tool-sign-language` (`packages/tool-sign-language`) holds
  the card validation, the content resolver, the registration and the
  `<pie-tool-sign-language>` custom element. It is the worked example of a capability
  contributed from outside the player: it is absent from `createPackagedToolRegistry`,
  so a deployment opts in by registering it.
- Data types: `@pie-players/pie-players-shared` (`packages/players-shared`) holds
  `CatalogCard`, `AccessibilityCatalog`, `PersonalNeedsProfile` and the card payload
  types.
- Runtime host: `@pie-players/pie-section-player`. It offers the `content-media`
  surface and mounts whatever is registered on it. It does not depend on the signing
  package and does not name signing, the `signLanguage` support id or the
  `sign-language` catalog type.
- Policy identity: signing takes a feature id and registers for policy, so it inherits
  the PNP precedence in `PnpPolicySource` ([Tool Policy Relationships](../../CONTEXT.md#tool-policy-relationships)).
  `ToolPolicyEngine.decideFeature(featureId)` and
  `ToolkitCoordinator.decideFeaturePolicy(featureId)` resolve one id through that
  precedence independent of placement, so no separate non-tool feature concept exists.
  Policy identity and rendering placement are separate; see
  [What Counts As A Tool](../tools-and-accomodations/architecture.md#what-counts-as-a-tool).
- Public export path: `@pie-players/pie-tool-sign-language` for the registration, the
  card validators and the content resolver. The generic media-payload helpers
  (`applyMediaFragment`, `enforceMediaFragment` and the normalizers) belong to
  `@pie-players/pie-players-shared/media`, which the signing package imports.
- Consuming packages or apps: `section-player`, the `assessment-toolkit` registry and
  policy engine, demo apps, `pie-qti` adapters, and pie-elements-ng only if per-node
  docking below the prompt is later scoped.
- Runtime environment: browser and custom element; data types stay Node-safe for
  importers and adapters.
- `item-player` knows nothing about signing.

### Placement On The Content-Media Surface

Signing fills the `content-media` Content Surface, a slot scoped to one item or
passage card, beside the `header` and `content` areas each card already declares. The
registration declares `activation: "region"`, `surfaces: ["content-media"]` and
`supportedLevels: ["item", "passage"]`. It is not a toolbar surface and not an
item-player affordance.

The card's `data-catalog-idref` says **what** the video translates; the layout says
**where** it appears. With one signing video per item, the video does not need to sit
next to a specific DOM node, so placement is a layout concern and presentation stays
policy-driven. Because signing has a feature id, its availability and presentation
parameters can be set at host, district, test-administration, item and student level
through existing machinery: `settings.districtPolicy`, `settings.testAdministration`,
an item's `settings.toolParameters`, and `personalNeedsProfile`. Only the parameter
vocabulary is new.

The surface is per content card. A section-wide slot would be the wrong shape: a
passage sits once beside a column of items because it is shared across them, while a
signing video belongs to one item or passage. `SectionItemCard.svelte` and
`SectionPassageCard.svelte` render the same `SectionCardMediaSplit`, differing only in
owner scope, so passage-owned signing renders on the passage card.

The surface name is generic. The slot holds a resolved catalog card, and audio
description is the same "docked alternate media, gated by PNP" shape, so naming it
after its first tenant would force a later rename for no saving.

### Surface Presentation

The first iteration's presentation is fixed and minimal:

- **To the right of the content.** A bottom placement imposes a scroll-away cost:
  signing is re-checked *while* forming an answer, so a video below the content means
  scrolling to it and back to the choices repeatedly. A side-by-side split keeps both
  visible regardless of item length, and text-first sequencing gives the item the
  leading position in an LTR reading flow. Being parallel, the split also avoids a
  problem an above/below split cannot solve: `item-player` renders prompt and choices
  as one opaque block, so the video cannot sit "after the prompt, before the choices"
  without breaking the boundary that keeps `item-player` ignorant of signing.
- **Resizable.** `SectionCardSplitDivider.svelte` follows the `SectionSplitDivider.svelte`
  pattern (pointer-based, keyboard-accessible, `role="separator"`, percentage-bounded)
  as a sibling with its own bounds, because the original is coupled to the
  passage/items grid and hardcoded to one orientation.
- **Stacking.** Below a 560px *card* width (`MEDIA_REGION_STACK_BREAKPOINT_PX` in
  `card-media-region.ts`) the video stacks and the divider withdraws. A
  `ResizeObserver` on the split container measures the card, so a narrow card in a
  wide viewport stacks too.
- **Sizing.** An aspect-ratio target with a height floor, retunable through three theme
  tokens: `--pie-section-player-item-media-aspect-ratio` (default `3 / 4`),
  `--pie-section-player-item-media-min-height` (default `220px`) and
  `--pie-section-player-item-media-max-height` (default `60vh`). The `item-media`
  prefix predates the `content-media` surface name.
- **No configurable orientation and no free drag.** Free 2D repositioning is the
  `ItemToolBar` floating-window pattern for movable utility windows such as the
  calculator, more affordance than the accessibility need calls for. The four-orientation,
  policy-gated generalization waits for a signal it is needed; the `toolParameters` seam
  is where it would hang. `SectionPlayerPolicies` has no layout policy (it covers
  readiness, preload and telemetry).

The header, content and footer structure around the split is still duplicated between
the two card components, and a token-documentation test asserts the card tokens appear
in both files.

## Contract Shape

The shipped card types, from `@pie-players/pie-players-shared`:

```ts
interface MediaFragmentRange {
  startSeconds: number;
  endSeconds?: number;
}

interface SignLanguageCardPayload {
  /** ISO 639-3 code of the adaptation; "ase" is ASL. */
  signLang?: string;
  media: MediaAssetRef;
  fragment?: MediaFragmentRange;
}

/** A recorded `spoken` alternate. */
interface SpokenAudioCardPayload {
  media: MediaAssetRef;
  fragment?: MediaFragmentRange;
}

type CatalogCardPayload = SignLanguageCardPayload | SpokenAudioCardPayload;

interface CatalogCard {
  catalog: string;    // QTI's `qti-card@support`: the only discriminator
  language?: string;  // the card entry's `xml:lang`
  visibility?: string;
  content?: string;   // the string form; absent on cards that have none
  payload?: CatalogCardPayload;  // the structured form, read according to `catalog`
}
```

A card carries either `content` or `payload`, never both. `catalog` is the only
discriminator, so the payload carries no `kind` that could disagree with it, and
nothing is mirrored between the two forms, so `content` is optional and a signing card
has no string form. `CatalogCard.content` and `ResolvedCatalog.content` are therefore
optional; `TTSService` treats a card with no string form as "no catalog" and falls
through to generated speech. The [integration guide](../accessibility/accessibility-catalogs-integration-guide.md#card-content-string-or-payload)
documents the rule for every card type.

The media block lives under `payload` and nowhere else. A `signLanguage` input alias
was tried and withdrawn: it was folded in on the resolution path only, so an aliased
card rendered its video while `hasAlternativeType(..., "sign-language")` reported none.
pie-elements-ng and the Learnosity import emit `payload`. A host running this player
against content built by older element types or an older import sees signing cards
stop resolving; `resolveSignLanguageMedia` warns on any `sign-language` card it cannot
resolve, and that warning is the signal.

`MediaAssetRef` is reused to keep one media vocabulary in the codebase, with two
consequences:

- Optionality is resolved per consumer; making every field optional at the type level
  would stop the type catching anything. For signing, a usable source is required, a
  language is expected (an unlabeled card is only a fallback), and duration does not
  apply. The media asset contract keeps the
  general schema-versus-policy question open.
- `tracks` and `transcript` are **meaningless** for signing: captions on a signing
  video would repeat the English text already on screen. No policy adds a caption
  requirement to signing media.

### Sign Language Selection

`signLang` names the language of the adaptation, AfA/PNP's `languageOfAdaptation`, and
is never inferred from the item's content language: a Spanish item's signed alternate is
LSM, not ASL.

- A card's effective sign language is `payload.signLang` when present, otherwise the
  card's `language`. The two coincide on almost every card, so producers state the
  language once, on the card; the Learnosity import emits `language` alone.
- The requested sign language is the `signLang` policy parameter (`toolParameters`),
  defaulting to `ase`.
- An exact, case-insensitive match wins regardless of card order. A card with no
  language is accepted when no exact match exists, because it cannot be shown to be a
  mismatch.
- A card labeled with another sign language is never substituted. ASL, BSL and LSF are
  not interchangeable, and a recording the learner may not follow is worse than none.
  The same card-array-plus-language mechanism used for multi-language spoken TTS
  carries every signed language at no extra cost.
- `describeSignLanguage` turns the code into the language name the video's accessible
  label and caption use. It names the language of the adaptation, from interface
  catalog keys (`SIGN_LANGUAGE_NAME_KEYS`), so it follows the interface locale
  and never the item's content language: a Dutch interface shows an ASL recording as
  "Amerikaanse gebarentaal". `ase`, `bfi`, `fsl`, `gss`, `mfs` and Signed English
  (`eng-US`, `en-US`) have names; an unrecognized code is labeled as a code, and a card
  with no language gets a generic name.

### Resolution And Gating

Resolution and gating reuse existing seams:

- `AccessibilityCatalogResolver.registerOwner(...)` owns the entity walk and
  registration transaction, and `forOwner(...)` owns scoped reads and observation. The
  content capability receives one immutable Catalog Owner Snapshot and applies strict
  `sign-language` and requested-language matching itself, so it cannot reconstruct a
  scope that registration never wrote. Direct lookup clients use
  `catalogOwnerContextFor(...)`.
- Docking stays `data-catalog-idref` on the content node, the attribute `SSMLExtractor`
  writes and `TTSService` reads.
- Eligibility comes from `PnpPolicySource`, at any level of its precedence.
- Resolution returns one card per owner scope. A `fragment` lets the type describe one
  recording serving several nodes, as in QTI 3; that is a model capability, and the
  shipped surface plays one card per item or passage.
- The player enforces the fragment's out point: `enforceMediaFragment` seeks forward
  after `loadedmetadata` and pauses at the end through `timeupdate` plus a 100 ms poll.
- `resolveSignLanguageContent` warns once each when the host has no catalog resolver,
  when the content carries sign-language cards with no playable media, and when the
  only cards are in a sign language the learner was not granted.

### Card Sources

A `sign-language` card is authored or written by an importer; there is no render-time
lift from item markup. A render-time extractor mirroring `SSMLExtractor` was
implemented and removed: nothing produced the inline form, a runtime without
`DOMParser` or one that hit a parse error left the video in the visible content for
every learner regardless of eligibility, and its positional catalog ids renumbered the
`data-catalog-idref` docking when content changed. Inline `<speak>` is real authored
content PIE does not control, which signing video is not.

### Availability Rule

Signing is available when **both** conditions hold: the content carries a matching
`sign-language` card, and policy grants eligibility. They are checked independently.

The content condition is the DRD half of AfA's matching pair (see
[What Counts As A Tool](../tools-and-accomodations/architecture.md#what-counts-as-a-tool)),
and it prevents a dead affordance on the large majority of items, which carry no
signing video. The eligibility half follows the accommodation tier: not granted by
default, because signing requires a documented need. The registration declares
`requiresAuthoredContent`, which keeps signing out of a host's wholesale grant
structurally.

`sign-language` cards are validated apart from text cards, so a malformed media payload
never degrades to an empty string or renders a URL as visible text.

## Compatibility

This PRD touches these surfaces:

- **Contract attributes.** `data-catalog-idref` gains a second reader. TTS behavior
  through that attribute is unchanged, and the attribute stays one canonical name with
  two readers.
- **Persisted and authored wire data.** `CatalogCard` gains a payload shape. Existing
  `{ catalog, language?, content }` cards keep resolving unchanged, and `content` is
  where every text-shaped type still lives. A `sign-language` card carrying a bare URL
  in `content` is reported and ignored: no producer writes that shape, and accepting it
  would mean a second code path for the same URL while discarding the MIME type, label
  and any second source.
- **Default PNP.** Signing is opted into explicitly. `createEmptyPersonalNeedsProfile()`
  grants nothing, and `@pie-players/pie-default-tool-loaders` ships the universal set as
  a named preset a host adopts (`createUniversalPersonalNeedsProfile()`). Signing's
  registration declares `requiresAuthoredContent`, so a host building its own grant list
  has a declaration to filter on.
- **pie-elements-ng.** Choice-level docking requires element markup to carry
  `data-catalog-idref` on choice nodes. That is element-repo work and is never faked by
  synthesizing ids in the player.

It does not change PIE element runtime or controller contracts, versioned `pie-*` tag
names, `pie-item-player` properties, events or methods, section completion state, or
assessment-player routing.

Catalog identifiers are never stripped, normalized, prefixed or slugged.
`data-catalog-idref` values are author-owned and round-trip byte-for-byte.

## Data Ownership And Host Responsibilities

PIE owns:

- the sign-language catalog card vocabulary and payload validation;
- resolution priority, language matching and fallback behavior;
- PNP gating and policy provenance for signing availability;
- the learner-facing affordance: how a signed alternate is discovered and played;
- coordination with TTS, other media and player tools;
- accessibility behavior of player-owned signing UI.

Hosts own:

- signing video production, storage, CDN, signed URLs, CSP, authorization, retention
  and privacy;
- accommodation eligibility: whether a given learner gets `signLanguage` at all;
- content authoring quality, including translation accuracy and coverage;
- import from external formats such as Learnosity into PIE catalog shape;
- reporting on accommodation usage.

## Serialization And Versioning

Catalog data is authored and wire-facing. The contract settles:

- versioning: the sign-language payload carries no version marker of its own. Its
  `media` is a `MediaAssetRef`, and this build renders only `version: 1`
  (`SUPPORTED_MEDIA_ASSET_VERSION` in `@pie-players/pie-players-shared/media`). A card
  whose media claims another version is reported and ignored; one whose media omits
  `version` is accepted, since producers predate the field;
- validation ownership: `@pie-players/pie-tool-sign-language` validates sign-language
  cards (`resolveSignLanguageMedia`), using the generic media normalizers in
  `@pie-players/pie-players-shared/media`;
- unknown-`catalog`-type behavior: unknown types are tolerated by `CatalogType`'s
  `| string` tail and ignored, with one report per token (see
  [Supported Catalog Types](../accessibility/accessibility-catalogs-integration-guide.md#supported-catalog-types));
- unknown-payload-shape behavior: a `sign-language` card whose payload does not validate
  is treated as absent and never rendered as raw text;
- fixtures: the package's card tests cover single-source, multi-source, poster,
  fragment-range and missing-language cards, plus the two rejected shapes (bare-URL
  `content`, and a payload with no usable source).

## Accessibility

This PRD is accessibility-scoped. The [accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md)
PRD is a Draft; the piece signing shares with other media today is the toolkit's
read-aloud handoff, `bindTtsAudioHandoff` and `pauseTtsForMediaAudio` from
`@pie-players/pie-assessment-toolkit/tools/registration`.

WCAG 2.2 covers sign language only at SC 1.2.6 (Sign Language, prerecorded), which is
**Level AAA** and scoped to prerecorded audio in synchronized media. Signing a text
prompt is not a WCAG AA obligation. ASL support in PIE is driven by assessment
accommodation policy and 1EdTech's Elevated Accessibility expectations; it is never
justified as an AA requirement, and AA conformance is no evidence that signing is
covered.

The shipped surface is a `<figure>` holding a native `<video controls muted playsinline
preload="metadata">` and a `<figcaption>` naming the language. It has no open or
dismiss step: the video is present whenever signing is available. Requirements:

- the video is keyboard reachable through its native controls, and its accessible label
  names the language (for example "American Sign Language");
- the video's own audio is off (`muted`). Whether the item's own narration is also
  suppressed while signing plays is open (see [Open Questions](#open-questions));
- signing playback and TTS never run simultaneously: the action the learner just took
  wins, and starting one pauses the other;
- the English content the card is docked to stays visible while signing plays, because
  both languages are in use;
- signing UI never obscures captions, transcripts, media controls or answer choices;
- the native controls supply pause, replay and, where the browser offers it, speed,
  since re-watching is normal for translation;
- high-contrast, 200% zoom, touch-target and reduced-motion behavior are verified;
- availability is discoverable when granted and absent when not, with no dead
  affordance for learners without the accommodation.

There is no signing equivalent of `data-tts-suppress`. Whether a clip gives a decoding
item away depends on fingerspelling versus lexical signing, a fact about the recording
known to the signer rather than to whoever authors an attribute. Suppression is also
per node while a signed alternate is one video per item, so the only available rule
would withhold a deaf candidate's whole translation over one word. TTS speaks whatever
text is present with nobody in the loop; a signed alternate does not exist until a
signer films it. This is revisited only if per-node signing docking lands *and* a
program authors signing for decoding-construct items.

Manual review is required: automated checks cannot judge whether a signing affordance
is findable or whether focus handling is sensible mid-item.

## Standards Or Adapter Impact

The mapping tells a future adapter where to start and keeps PIE from inventing a second
name for a concept QTI already names. Where the standard and PIE diverge, PIE's needs
win and the divergence is recorded here.

| QTI 3 / APIP | PIE | Note |
| --- | --- | --- |
| `qti-catalog id="..."` | `AccessibilityCatalog.identifier` | Direct. |
| `qti-card support="sign-language"` | `CatalogCard.catalog: "sign-language"` | Token already matches. |
| `qti-card-entry xml:lang="ase"` | `CatalogCard.language` | ISO 639-3; `ase` is ASL. The payload's optional `signLang` names the same code and is authored only where it differs. |
| `qti-html-content` with `<video>` and multiple `<source>` | `SignLanguageCardPayload.media` | A flat `content: string` cannot carry this. |
| Media Fragments URI on the source | `fragment` | QTI 3 replaced APIP's separate start/end cue elements with fragment notation, letting one recording serve several nodes. |
| `data-catalog-idref` docking, conventionally on a hidden docking div | `data-catalog-idref` | The same attribute PIE uses for TTS. |
| APIP `signFileASL` / `signFileSignedEnglish` | catalog card + language | APIP's two sign types collapse into card language. Signed English is not needed for the current US scope. |
| PNP 3.0 / AfA `sign-language` | `PersonalNeedsProfile.supports` | `signLanguage`, the sign-language tool's id: the AfA term, camelCased. |

The table covers signing only. Two neighboring divergences are documented in the
integration guide: QTI's `spoken` card may carry a recording, which PIE reads as
`SpokenAudioCardPayload` ([Recorded Audio as a Spoken Alternate](../accessibility/accessibility-catalogs-integration-guide.md#recorded-audio-as-a-spoken-alternate)),
and `ext:`-prefixed vendor support tokens, which `isKnownCatalogType` accepts in an open
`CatalogType` ([Supported Catalog Types](../accessibility/accessibility-catalogs-integration-guide.md#supported-catalog-types)).

Import and export mapping, if built, belongs in `pie-qti`, which documents any lossy
transform, in particular whether the hidden-docking-div convention survives a PIE round
trip.

## Relationship To Section-Player And To Timed Media

**Section-player is the runtime host** for signing. The accessibility catalog resolver
lives in `assessment-toolkit`, which section-player consumes, and section-player
already renders `spoken` catalog cards through the path this PRD extends. Signing is a
new *type* of catalog card and a new renderer on an existing host. The host
relationship is by surface: section-player mounts whatever declares
`surfaces: ["content-media"]`, and signing lives in its own package.

Signing is not a section flavor. [Timed media](./timed-media-section-contract.md) is
one: it introduces `sectionType: "timed-media"` and cue orchestration, and runs in the
existing section-player layouts, because it composes multiple items around a shared
timeline. Signing has many short recordings, each translating one content node, played
on learner demand and gating nothing.

Modeling ASL as a passage with a specialized ASL section layout is rejected by facts 1
and 2: the video translates a prompt, and it coexists with the English content inside
the same item.

| | Timed media | Sign language |
| --- | --- | --- |
| Runtime host | Section-player (existing layouts) | Section-player (existing catalog rail) |
| Section-level flavor? | Yes (`sectionType`) | No |
| Media count | One shared stimulus | Many short recordings |
| Timeline role | Reveals, gates, sequences items | None |
| Trigger | Playback position | Learner demand |

The one data overlap is time-ranged playback. QTI 3's Media Fragments usage lets one
signing recording serve several content nodes by time slice, the same "video plus
timestamps" primitive timed media needs, without the cue policy. Both contracts share
`MediaFragmentRange` from `@pie-players/pie-players-shared`, carried beside the asset
as the [media asset contract](./shared-contracts/media-asset-contract.md) defines. The
read-aloud handoff rule above also binds the timed-media stimulus.

## Test Plan

Coverage in place:

- `packages/tool-sign-language/tests/sign-language-cards.test.ts`: payload validation
  (single-source, multi-source, poster, fragment range, missing language, unsupported
  media version, bare-URL `content`, no usable source, and the withdrawn `signLanguage`
  key), language matching, language naming, and one catalog identifier serving
  `spoken` and `sign-language` readers independently.
- `packages/tool-sign-language/tests/sign-language-content.test.ts` and
  `sign-language-registration.test.ts`: content resolution from an owner snapshot and
  the registration's declarations.
- `packages/assessment-toolkit/tests/policy/sign-language-feature-policy.test.ts`: PNP
  precedence for `signLanguage`, including `prohibitedSupports`, and policy parameters.
- `packages/default-tool-loaders/tests/universal-supports.test.ts`: the universal preset
  grants no id belonging to a registration that declares `requiresAuthoredContent`, and
  the empty profile grants nothing.
- `packages/section-player/tests/section-player-sign-language-region.spec.ts`: the
  signed alternate shows when granted and the item carries a card, the bundled clip
  plays, a passage card shows its signing, no dead affordance without a card, nothing
  without a grant, the English content stays visible, no re-registration loop, the
  video sits beside the content, and the divider is a keyboard-operable separator.
- `packages/section-player/tests/pie881-imported-asl-integration.spec.ts`: the
  unmodified output of the Learnosity import (a synthetic source item with a
  public-domain clip) resolves, gates and plays.

Gaps:

- no test of TTS/signing mutual exclusion;
- no keyboard or focus test on the video itself;
- no DOM-level test that TTS on a docked node is unchanged when the same
  `data-catalog-idref` also resolves a signing card.

Manual screen-reader and keyboard walkthroughs remain required.

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

- Changeset: required for public exports, the `content-media` surface and the
  `@pie-players/pie-tool-sign-language` package, under the lockstep versioning policy.
- Migration notes: additive for authored content; `spoken`, `braille` and other
  string-form catalogs keep working. At the type level, `CatalogCard.content` and
  `ResolvedCatalog.content` are optional (see [Contract Shape](#contract-shape)), so a
  consumer that reads `.content` as a `string` needs a guard. Hosts supplying their own
  `PersonalNeedsProfile` see no change until they grant `signLanguage`.
- Documentation: the accessibility catalog quick start and integration guide,
  tools-and-accommodations docs, the PNP debugger tool docs and `pie-qti` adapter PRDs.
- Release risk: medium-high. The runtime surface is small, but it is an accommodation:
  a silent failure means a learner cannot read the item, and it is invisible to hosts
  that do not test with `signLanguage` granted.

## Open Questions

- **Item narration during signing.** The video is muted. Whether the item's own
  narration is also suppressed while a signed alternate plays is undecided; it is
  related to, and separate from, the read-aloud handoff rule.
- **International sign-language variants.** ASL, British Sign Language and French Sign
  Language are not interchangeable, and international rollout needs separately authored
  content per variant. The language-tagged card mechanism already generalizes to this,
  so nothing is built differently now; recorded so the framework is not assumed to be
  ASL-only. Separate from Signed English, and not a near-term requirement.
- **Presentation parameter vocabulary.** [Surface Presentation](#surface-presentation)
  settles the first iteration's layout, not the names a configurable version would
  take. The seam is `toolParameters`; the vocabulary is new and PIE-local, since AfA
  has no signing-layout token. Deferred with the generalization itself.
- **Video sizing numbers.** The mechanism is settled (aspect-ratio target plus height
  floor, exposed as theme tokens); the numbers were chosen against a stand-in clip.
  The import was proved against a real item that cannot live in any repository, so the
  question stays open until a redistributable real ASL clip exists.
- Should PIE surface *coverage*, which content has signing available, so a learner is
  not left guessing? Low stakes while signing is one per item; it matters if per-node
  docking lands.
- How does signing interact with the line reader, highlighter and other capabilities
  that own the same content nodes?
- Does accommodation-usage telemetry belong in the instrumentation stream, and if so
  what is emitted without recording accommodation status as learner data?
