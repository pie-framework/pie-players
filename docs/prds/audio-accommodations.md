# Audio Accommodations: Transcript And Autoplay Control

Status: Accepted for the `pie-players` contract. The autoplay half remains a
proposal.

Owner: PIE Players maintainers

Implementation status, 2026-08-15. **The `pie-players` half has landed**: 60af674d resolves transcript visibility as a capability in `@pie-players/pie-default-tool-loaders`, rendered by the toolkit into a card surface; 61d6aa0c gives print the same resolution. What shipped differs from this PRD in two ways, recorded in [Rendering](#rendering-a-region-not-an-element-concern): the region is a capability-owned tool surface rather than markup in `SectionItemCard.svelte`, and the card carries a `visibility` discriminant so one shape serves both authored presentation and the accommodation.

Cross-repo status, 2026-09-27. [Sequencing](#sequencing) step 3 ran on 2026-08-12. Outstanding: the `mc-populated-blank` print build in `pie-elements-ng` still renders `audioTranscript`, the content transform still writes that field for it, and whether step 3's data precondition held is unverified from `pie-players`.

Related architecture:

- [What Counts As A Tool](../tools-and-accomodations/architecture.md#what-counts-as-a-tool) — the eligibility / content-dependency / placement split this PRD applies to audio
- [Sign Language (ASL) Support](./sign-language-asl-support.md) — the same three-part shape, already implemented; this PRD is its second instance
- [Accessibility Catalogs Integration Guide](../accessibility/accessibility-catalogs-integration-guide.md)
- [Accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md)
- [Media asset contract](./shared-contracts/media-asset-contract.md) — for the recorded-audio card form

Source material: a transcript requirement page, which states the requirement and why it must be accommodation-gated rather than universal, and an autoplay item inventory, which counts about 1,200 affected items and asks, as an open item, whether PIE has an equivalent of Learnosity's `Enable` action. This PRD answers that question and proposes where the missing half belongs.

## Problem

An early-literacy assessment delivers prompts as recorded audio with no on-screen text, because it targets pre-readers. Some states hold that WCAG's audio-transcript requirement applies, so affected items carry an `audio_transcript` property that must appear before the audio player — but **only for students identified as needing it.** Universal display would break three item families outright: audio-only items aimed at pre-readers, letter-sound items ("which letter makes the /s/ sound"), and any listening-comprehension item, where showing the passage as text changes the construct being measured.

That is an accommodation, and PIE has the machinery for accommodations — the machinery signing uses. The first implementation predated it.

**Until 2026-08-12, in `pie-elements-ng` `mc-populated-blank`:** delivery rendered `model.audioTranscript` into the DOM unconditionally and decided only whether it was *visible*, from a class the host placed on an ancestor, watched with a `MutationObserver` over every ancestor's `class` attribute. It worked, and it was the right way to ship before the toolkit existed. Its costs were real:

1. **The decision was invisible to policy.** No support id was consulted, so district, test-administration, and item-level precedence could not reach it, and the PNP debugger could not show it. The accommodation existed but was unauditable.
2. **Every element with audio had to reimplement it.** The sniff, the observer, and the `sr-only` convention were per-element code.
3. **There were two mechanisms, and the model one was dead.** The controller computed `showVisibleTranscript`; delivery shadowed it with `const showVisibleTranscript = $derived(ancestorHasTranscriptClass)`. Whatever the model said was discarded at render.
4. **The gate was visual, not informational.** When not revealed the transcript stayed in the DOM as `sr-only`, wired into `aria-describedby`, so assistive technology read it regardless of the accommodation. For a listening-comprehension item that is the construct the gate exists to protect. See [Accessibility](#accessibility).

**Decided: the class is not carried forward.** An earlier draft of this PRD proposed keeping that class working by having section-player write it. Rejected 2026-08-08 — a DOM class as an accommodation channel does not fit the catalog model, and preserving it would mean two sources of truth for one decision, permanently. The migration path is a **backend content transform** that reshapes affected items into PIE's catalog model — concretely, the Learnosity → PIE mappers in `pie-api-aws` that the affected content already flows through, which carried the ASL video into catalogs the same way. Legacy shape in, PIE shape out; the runtime learns nothing about either. See [Where The Transform Lives](#where-the-transform-lives).

## Goals

- Represent an audio transcript as an accessibility catalog card, resolved and gated the way every other alternate representation is.
- Give the transcript a policy identity, so eligibility resolves through the existing PNP precedence and appears in the PNP debugger.
- Require **no element awareness of accommodations.** Elements do not read policy, do not sniff classes, and do not decide who sees a transcript.
- Define what the backend transform must emit, precisely enough to implement against.
- Answer whether autoplay needs a policy identity at all, or whether it is a content-variant property the same transform should settle.

## Non-Goals

- No support for the legacy ancestor class and no compatibility shim for it. Items are transformed, not accommodated.
- No force-listen gate (blocking answer or advance until playback completes). That is progression control, and it belongs to section-player alongside timed-media gating. Named here only to fence it out.
- No new audio player element, and no change to how an element renders its own audio control in this PRD's scope. See [Where The Audio Itself Should Live](#where-the-audio-itself-should-live) for the direction that would change that, deliberately deferred.

## Package And Export Ownership

- Owning package: `@pie-players/pie-assessment-toolkit` for the support id, the decision API and the grant-AND-content rule; `@pie-players/pie-default-tool-loaders` for the capability itself; `@pie-players/pie-section-player` and `@pie-players/pie-print-player` for rendering it into their own surfaces.
- Public export path: `resolveContentCapabilities` on the `tools/registration` entry, `AccessibilityCatalogResolver` on a narrow `services/` subpath so print can reach it without bundling the toolkit root, and `accessibility` on `<pie-print>`'s config. `ToolkitCoordinator.decideFeaturePolicy(featureId)` and `AccessibilityCatalogResolver.getAlternative(...)` need no additions.
- Consuming packages or apps: section-player, print-player, PNP debugger. `pie-elements-ng` loses code rather than gaining any.
- Runtime environment: browser.
- Outside this repo: the content side lands in `pie-api-aws` — its Learnosity → PIE transform, plus a backfill for items already in PIE form. That work is independently shippable and goes first; see [Where The Transform Lives](#where-the-transform-lives).

## Contract Shape

No new types. A transcript is a string alternate, so it is a `CatalogCard` with `content` — the form that has existed since catalogs landed.

```json
{
  "identifier": "q1-transcript",
  "cards": [
    {
      "catalog": "transcript",
      "language": "en-US",
      "content": "The word is look. Pick the correct spelling of the word look."
    }
  ]
}
```

`transcript` is the AfA support term, and no tool registers under it yet, which is the same position `sign-language` was in before signing shipped.

It must not be granted by default, for the reason the requirement page gives — a transcript shown to a student who did not need it can invalidate a listening-comprehension item, so inheriting it by default is worse than not having it at all.

Revised 2026-08-09: an earlier version of this section added `transcript` to `ACCOMMODATION_ONLY_SUPPORT_IDS` in `defaultPersonalNeedsProfile.ts`. That array and the profile derivation it filtered are both gone — the core grants nothing, and `@pie-players/pie-default-tool-loaders` ships the universal set as a named preset. The transcript registration declares `requiresAuthoredContent` instead, which is both the render gate (no card, nothing to show) and the declaration a host filters on when building its own grant list:

```ts
requiresAuthoredContent: {
  resolve: ({ catalogs, granted }) =>
    findTranscriptCard(catalogs, { granted }),
},
```

### What The Backend Transform Emits

Per audio-bearing model, the transform moves `audio_transcript` out of element model data and into a catalog on that model:

```json
{
  "id": "q1",
  "element": "mc-populated-blank",
  "hasAudio": true,
  "audioUrl": "https://cdn.example.com/audio/q1.mp3",
  "accessibilityCatalogs": [
    {
      "identifier": "q1-transcript",
      "cards": [
        { "catalog": "transcript", "language": "en-US", "content": "The word is look. …" }
      ]
    }
  ]
}
```

Three properties of that output matter:

- **`audioTranscript` and `showVisibleTranscript` are dropped from the model.** The text lives in exactly one place. An item that still carries them is a partially-transformed item, and the element should stop reading them in the same release. Step 3 dropped `showVisibleTranscript`; [Sequencing](#sequencing) records why `audioTranscript` remains.
- **The catalog identifier is opaque to PIE, but not arbitrary for the transform.** Nothing in PIE parses, prefixes or slugs it, per the repo's identifier rule — round-trip it byte-for-byte. The transform still needs it *deterministic*, because the backfill recognises its own previous output by it, so the shipped convention is `${modelId}-transcript` and the examples above use it.
- **`data-catalog-idref` docking is optional here, and usually impossible.** This is the one structural difference from signing: an audio prompt is not authored markup, it is a model field (`audioUrl`), so for the audio-only items that need transcripts most there is no author-written node to dock to — `sentenceHtml` is empty by design for pre-readers. The card therefore resolves by **owner scope** rather than by docking: the player collects catalogs registered for the item that carry a card of the requested type, exactly as `collectSignLanguageCatalogRefs` does for signing, and resolves through `getAlternative` from there. That mechanism already exists and should be generalized by catalog type rather than copied.

### Where The Transform Lives

The affected content reaches PIE through the Learnosity → PIE transform in `pie-api-aws`, so the backend content transform above extends an existing pipeline. One mapper reads the source transcript field, and every item type that reaches it maps to `mc-populated-blank`, which matches the element-side finding that `mc-populated-blank` is the only element implementing the transcript.

The transform also decided transcript visibility at import time, from the item's layout profile. Layout is not a statement about a student's needs: a rule of that shape guesses at an accommodation from content shape, which a PNP profile exists to stop. The rule went with the field, and the decision moved to policy.

The signing import is the precedent:

- The catalog *shapes* are restated in the transform rather than imported, because `pie-api-aws` depends on neither the player nor the element repo; fixture parity is the drift protection. No model type declares an `accessibilityCatalogs` field, so the write lands through `PieModel`'s index signature and nothing type-checks the field name at the assignment. A transcript card is a new card type in a structure that already ships.
- Same module shape: a cheap substring bail-out before any parsing, one catalog per source artifact, identifiers round-tripped byte-for-byte.
- **Unlike signing, no docking node is written.** The signing transform replaces an inline video span in the prompt with a hidden `data-catalog-idref` node, because the video *was* in the markup and leaving it there would render it ungated to everyone. An audio prompt is never in the markup — it becomes `model.audioUrl` — so there is nothing to remove and nowhere to dock. This is the source-data cause of the owner-scope resolution decided above.

The field cutover ran behind an additive bridge: the import emitted the catalog card and kept `audioTranscript` / `showVisibleTranscript` on the model until section-player rendered the region. The signing import's earlier URL bridge set the rule it followed — a bridge is safe only while something verifies its far end still exists, which the fixture-parity tests do. The transcript hook reads the *mapped model* rather than the raw question, so one hook covers every mapper that carries audio. The bridge was removed on 2026-08-12; transcripts reach delivery only as catalog cards. [Sequencing](#sequencing) records what remains.

### Re-Transforming Items Already In PIE Form

Items re-imported from Learnosity source pick up a transform change by re-running the import. Items **already stored in PIE form** hold `audioTranscript` on the model and no catalog, and re-deriving them from Learnosity is not always available or desirable.

A backfill command covers them. It runs the *same* transcript function the importer runs, so there is one definition of what a transcript card looks like, and writes only models it changed; a dry run reports without writing. It is re-runnable, because content keeps landing from pipelines that have not been updated, and built around two requirements:

- **Idempotent.** Re-running finds a transcript card already present and writes nothing. Detection is by card *type*, not by identifier, so a transcript authored under some other identifier also counts — two transcripts for one audio prompt would leave a player picking one.
- **Silent on items without a transcript.** No catalog field, no model rewrite, byte-identical output. A whitespace-only transcript counts as none.

### Rendering: A Region, Not An Element Concern

`pie-elements-ng` has no dependency on `@pie-players/pie-assessment-toolkit` and consumes no toolkit context anywhere — verified across the whole repo. So an element *cannot* read a policy decision today, and giving it one would create an element→toolkit coupling the architecture has deliberately avoided: elements render content, the player owns accommodations. That is the same boundary the signing region was built to respect.

So the transcript renders into a **card surface the capability fills**, not markup the card owns. `CONTENT_LEAD_SURFACE` (`"content-lead"`) is full width, above the card body, in document flow — separate from `CONTENT_MEDIA_SURFACE` because the geometry is the whole difference: docked media is watched beside the content and sized by an aspect ratio, while a text alternate is read *before* the control it belongs to. Item cards and passage cards both open it, so reading order is header → transcript → audio prompt on either.

That placement satisfies the requirement page's "text appears before the audio player" in reading order, at item granularity rather than immediately-adjacent granularity, which remains an open question for the requirement's owner.

As shipped, the card's `visibility` field is the discriminant: `"always"` is authored presentation — the item family was designed to be delivered with its transcript on screen, so no profile grants it and none revokes it — and anything else, `"onGrant"` included, is the accommodation, decided against the `transcript` support id with silence meaning no. That is why the registration ships in the packaged set while signing does not: an item authored to show its transcript must show it in every player, and a deployment that forgot an import would silently deliver a designed-for reading support as nothing. The accommodation half is still policy-gated exactly as signing is, and `transcript` stays out of the universal preset.

The rendered region carries a labelled accessible name and deliberately no `aria-describedby` back to the element's audio control: a description is announced as a flat string on focus, which is worse to listen to than reading order for multi-sentence text.

### Where The Audio Itself Should Live

The end-state this points at, recorded now and deliberately not proposed for implementation: an audio prompt is itself an alternate-representation-shaped thing. `spoken` has since gained the recorded-audio payload form (see the [signing PRD's resolved decisions](./sign-language-asl-support.md#resolved-decisions)), so the missing piece is no longer the card shape: one docking node can already carry three cards — `spoken` (recorded audio), `transcript` (text), `sign-language` (video) — each gated by its own support id, all rendered by the player, and elements own no accommodation media at all. Autoplay becomes a player concern at the same moment, which is what would finally give the app-level override somewhere to live.

The cost is that early-literacy layout moves into the player: `mc-populated-blank` currently places its Listen button inside the item layout (`layoutProfile: 'audio_blank_only'`, feature-button skins, inline sentence audio), and the autoplay page already flags Listen-button UX as unscoped. That is a content and UX programme, not a refactor. This PRD stays compatible with it: nothing proposed here adds element coupling, so the larger move remains open.

## Compatibility

This PRD touches:

- **PIE element runtime/controller contracts.** `pie-elements-ng` `mc-populated-blank` loses `audioTranscript` / `showVisibleTranscript` from its model, and loses the class sniff, the ancestor `MutationObserver`, and the `sr-only` transcript node. `Print.svelte`'s transcript rendering goes with them: the print player resolves the card itself, so an element copy would print a second transcript rather than the only one. All of it went on 2026-08-12 except `audioTranscript` and the print rendering; see [Sequencing](#sequencing).
- **The Learnosity → PIE transform in `pie-api-aws`.** A catalog card replaced two model fields, and the layout-profile visibility rule went with them. Autoplay adds a layer: the legacy tag rule stays, so nothing moves until a program supplies a per-collection map. Fixture parity with this repo's card shape is the only thing keeping the two sides in agreement, since neither repo imports the other's types.
- **Persisted/authored wire data.** Authored items change shape, by transform, in the backend pipeline. Items must not be half-transformed: the element stops reading the old fields in the same release the transform stops emitting them, or the transcript silently disappears for the population that needs it. A bridge flag made that a scheduled flip rather than a race; step 3 removed it on 2026-08-12.
- **Contract attributes.** Adds the `content-lead` card surface (`data-pie-tool-surface="content-lead"`) on item and passage cards, which the transcript capability fills with a labelled region. Removes PIE's dependence on the legacy ancestor class; hosts may keep writing it, and it means nothing.

It must not change versioned `pie-*` tag names, `pie-item-player` properties/events/methods, section completion state, or assessment-player routing.

## Data Ownership And Host Responsibilities

PIE owns: the support-id vocabulary, precedence evaluation, catalog resolution, the region and its accessible wiring.

Hosts own: which students have the accommodation, transcript text and audio assets, and the program-level decision about autoplay.

The content transform that produces PIE-shaped items is host-side and first-party — the `pie-api-aws` pipeline — which is why the transform half can be specified rather than merely required. Nothing in PIE may assume the transform ran.

## Serialization And Versioning

No new persisted or wire-facing types. The transcript card is `CatalogCard` unchanged; the removal of two model fields is a content-pipeline migration, not a schema version bump. Round-trip fixtures should cover one real transformed early-literacy item, since the transform is where this can silently go wrong.

## Accessibility

- An accommodation that was gated by an undocumented class is gated by the student's profile, at the right precedence, auditable in the debugger.
- The transcript must be programmatically associated with the audio it transcribes. With the region no longer inside the element, `aria-describedby` across that boundary needs an explicit id contract — the item card knows the region's id, the element owns the audio node, and nothing currently connects them. This is the accessibility detail most likely to be lost in implementation.
- Revealing the transcript must not move focus.
- In delivery an ungranted transcript is not rendered, so it is absent from the accessibility tree. The element's `sr-only` copy, which kept it there regardless of the grant, was removed in step 3.

## Standards Or Adapter Impact

`transcript` is an AfA/PNP 3.0 support token and QTI 3 carries transcript-style alternates as catalog cards, so the mapping is free — but as with signing, QTI is inspiration rather than an interop target and no conformance is claimed. Autoplay has no standards token; AfA's nearest neighbour is `audioControl`.

## Test Plan

Required test coverage:

- feature-decision tests for `transcript` across every PNP precedence rule, mirroring `tests/policy/sign-language-feature-policy.test.ts`;
- a regression test pinning that `transcript` stays out of any wholesale grant, via the composition package's assertion that no support id in `createUniversalPersonalNeedsProfile()` belongs to a registration declaring `requiresAuthoredContent`;
- resolver tests for a `transcript` card resolved by owner scope with no `data-catalog-idref` present — the case signing never exercises;
- section-player tests for granted / not-granted / granted-but-no-card, and for reading order placing the transcript before the audio;
- an accessibility test asserting the transcript is associated with its audio across the region boundary;
- a transform fixture: one real early-literacy item before and after, asserting the text moved and the old model fields are gone.

In `pie-api-aws`, following the pattern the ASL import's tests established:

- a real early-literacy item as fixture, asserting the emitted card's shape matches this repo's `CatalogCard` exactly — the fixture is the only thing preventing drift between two repos that share no types;
- an item with audio and no `audio_transcript`, asserting byte-identical output;
- backfill idempotency: running it twice yields one catalog, not two;
- for the autoplay policy: both fixtures' legacy answers unchanged with no options, one collection named in each direction, exact-token matching, an item whose collections sit only in the multi-value tag, and a conflicting policy leaving the legacy value and reporting.

Commands:

```sh
bun run typecheck
bun run test
bun run check:source-exports
bun run check:consumer-boundaries
```

Playwright-backed tests must run outside the sandbox.

## Rollout And Release Notes

- Changeset required: yes — a new entry in the exclusion list, a new region, and new section-player behavior.
- Documentation updates: tools-and-accommodations architecture, accessibility catalog quick start and integration guide, PNP debugger inputs.
- Release risk: high, not for technical complexity but because both failure directions are silent — a missing transcript for a student who needs one, and a visible transcript on a listening item for a student who does not.

### Sequencing

Three steps, in this order. The order is the whole risk control: every step leaves delivery working, and no step depends on a release in another repo shipping first.

1. **Content transform, additive — written 2026-08-08, landed ahead of step 3.** The import emits the `transcript` catalog card *and*, with the bridge flag on, keeps `audioTranscript` / `showVisibleTranscript`. The backfill command does the same for items already in PIE form. Delivery is byte-for-byte unchanged in behaviour — the element still reads the fields it always read, and the new card is inert data nothing looks at yet. Shippable on its own.
2. **`pie-players` — landed 2026-08-12, print 2026-08-14.** The capability declares `requiresAuthoredContent`, resolves by owner scope and catalog type, and renders into the `content-lead` surface on item and passage cards. Students granted `transcript` now get it from the card; everyone else is unaffected. Content transformed in step 1 already carries what this needs, so this step was shippable before it.
3. **Content transform + `pie-elements-ng`, destructive — ran 2026-08-12.** Flip the bridge flag off, re-run the backfill, and remove the field read, the class sniff, the ancestor `MutationObserver`, and the `sr-only` node from `mc-populated-blank`. Only now is the class dead. The transform removed the flag and `showVisibleTranscript`; the element removed the delivery read, the sniff, the observer, and the `sr-only` node with its `aria-describedby` (392bfcf4, e00e141a).

The one hard precondition, and it sat between steps 2 and 3: **the affected population's profiles must grant `transcript` before step 3 removes the old path.** Until then the class was what actually delivered the accommodation. Getting that backwards is the silent-failure mode this PRD's release risk names, and it is a data question, not a code one. Step 3 has run, and whether the profiles granted `transcript` first is unverified from `pie-players`.

Print belongs to step 2: the print player resolves the card against the profile the same way, so a printed transcript does not need the model field. Step 3 left one element print build reading it: `mc-populated-blank`'s renders `audioTranscript` for every learner. An item carrying both the field and a card therefore prints two transcripts wherever the card is in play, and the element's ungated copy wherever it is not. What remains of step 3 is removing that read and the field.

## Answering The Autoplay Page's Open Item

Its open item #3 asks whether PIE supports the equivalent of Learnosity's `Enable` action. It does, at the item level, already:

| Learnosity behavior | PIE today |
| --- | --- |
| `Play` (broken): audio autoplays, Listen button disappears, no replay | Not reachable. `AudioPlayer.svelte` renders a permanent control in both of its modes — a Listen button in `feature-button` mode, native `<audio controls>` in `controls` mode. Neither can vanish after playing. |
| `Enable` (the fix): Listen button present, autoplay follows the app setting | `autoplayEnabled` prop plus a permanent Listen button — same behavior. |
| Browser refuses programmatic playback | Partly handled, and worth fixing: the `blocked` state is derived in both modes, but the "click to enable autoplay" affordance is rendered only inside the `controls` branch. The early-literacy layout profiles this PRD is about select `feature-button` (`useFeatureButtonAudio: true`), so for exactly those items a blocked autoplay currently surfaces nothing. Learnosity's model has no equivalent either way. |
| App-level setting overrides the item | **Missing**, and probably misframed — see below. |

The per-item template edits that page estimates fix a Learnosity-only defect; PIE items do not have it, so the roughly 1,200 items need no hand edit for PIE.

On the missing row: the page has autoplay going *both* ways by product — one product wants it on for the general population, another may want it off — which is a property of the program, not of a student's needs. So the content transform is the natural home, and it already derives the flag.

### Autoplay Is Already A Transform Property

`autoplayAudioEnabled` is already derived per item at import, from the item's collection tags: autoplay is on when any collection value names a reading or math subject. That substring rule is where the page's on-for-one-product, off-for-another requirement currently fails. The program variants the page wants to distinguish are already distinct tag values, and the substring test collapses them, so all of them get autoplay on.

**Written additively 2026-08-08: a per-collection autoplay policy.** The substring rule is untouched and keeps producing what it always produced; the policy runs after the mappers and overrides the result only for collection tokens a caller has explicitly named. With no options every item imports byte-identically, a program migrates by being named one token at a time, and unnamed collections keep the legacy answer. The mechanism can land before the open product question below is answered. Once every collection in the bank is named, the substring rule is dead code.

- **Tokens match exactly**, which ends deciding on substrings.
- **Conflicts are reported.** An item shared by a program that wants autoplay and one that does not has no correct single answer at import; the legacy value stands and the item is logged for a human to decide.

The additive path does not inherit two defects in the legacy rule, both of which silently produce autoplay off on items that should have it. They stay in place, because fixing them moves live content underneath itself while the product question is open:

- **The multi-value collection tag is invisible to it.** An item whose collections are recorded only there is treated as in-collection everywhere else and gets `autoplayAudioEnabled: false`.
- **Only the first tag value is read**, so membership order silently picks the answer for an item in several collections. The rule behind `completeAudioEnabled` has both defects identically, and no additive path yet.

A count against production content on 2026-08-17 found about a hundred distinct items whose answer would change. Almost all were early-literacy preview content that the multi-value tag places in a reading collection; the rest were reachable only through the multi-value tag and nearly inert. No operational item with prompt audio changes answer. Whether the preview items reach a learner is a content-operations question. The array-order defect never fired.

The change is one-way — false to true only, so nothing that autoplays today stops — and nothing changes until affected items are re-imported. Some mappers assign both flags without checking for audio, so a re-import also writes `true` onto affected items with no audio: inert at delivery, visible in a model diff.

**The policy layer cannot address items that record their collections as one comma-joined value.** The substring rule reads through them; the policy matches tokens exactly and receives the joined string as one token, so no per-program map can name them until the token collector splits on comma.

Both rules read the same tokens and differ only in what they do with them — substring subject test versus exact lookup — so a policy can name any collection the legacy rule can see.

So the question to settle is unchanged: **is runtime-adjustable autoplay a requirement, or is per-program content the answer?** A policy id is justified only if a *teacher or district* must change autoplay at delivery time (one product has such a setting and another does not, per the page). If per-program content is the answer, this half closes in the content transform with no change in PIE: a `byCollection` map per program, and a matching per-program `completeAudioEnabled` decision, which needs the additive path the `completeAudioEnabled` rule lacks. Since `pie-elements-ng` 7077034c (2026-09-25), `completeAudioEnabled` on its own makes an item report `complete: true` only once the prompt audio has played to the end, in multiple-choice (and EBSR through it), categorize, hotspot, drag-in-the-blank, image-cloze-association and `mc-populated-blank`; before, it took effect only with autoplay on. A map that turns autoplay off for a collection the `READING` rule matches therefore leaves those items waiting on the audio.

## Open Questions

- **Is item-granular placement acceptable for the transcript?** Keeping accommodations out of elements means the transcript renders above the item content, not immediately above the audio control inside the element's layout. Reading order is preserved; adjacency is not. Needs the requirement owner's confirmation, since the alternative is element→toolkit coupling.
- **Resolved: print receives the card, not the model field.** `@pie-players/pie-print-player` resolves accessibility catalogs itself, against a profile passed as `config.accessibility` — the same policy engine, catalog resolver and grant-AND-content rule delivery uses, asked once instead of continuously, since a print job is one learner with one profile and nothing to toggle. An alternate in play prints inline and unconditionally; there is nothing to reveal on paper. So `Print.svelte`'s `model.audioTranscript` read is removable; step 3 left it in place, and [Sequencing](#sequencing) records the consequence.
- **Resolved: passages get it from the same surface.** `SectionPassageCard.svelte` opens `content-lead` exactly as the item card does, so the capability reaches both without knowing which card it is in. The surface is named for the relationship — an alternate is authored against a content node, and a passage owns content nodes as an item does — which is what removed the duplication this question was raised against.
- **Is runtime-adjustable autoplay required?** See above. If not, the autoplay half is a transform, not a feature.
- **Resolved: the card's `language` needs no new source and no conversion.** The transform already knows the item's language, in POSIX form (`en_US`, `es_ES`). `AccessibilityCatalogResolver` normalizes separators and case on both the card and the request (`normalizeLanguageTag`) and matches through the RFC 4647 lookup sequence, so a card emitted as `es_ES` matches an `es-ES` request on the exact rung.
