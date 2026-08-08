# Audio Accommodations: Transcript And Autoplay Control

Status: Draft

Owner: PIE Players maintainers

Implementation status: the content half is written — [Sequencing](#sequencing) step 1, plus the additive per-program autoplay path — and is behaviourally inert by design. It sits **uncommitted** on `pie-api-aws` `feat/PIE-881-asl-video-import` as of 2026-08-08, so "written" means the code exists and its tests pass, not that it has landed. Nothing in `pie-players` or `pie-elements-ng` has changed yet, so the accommodation is still delivered by the legacy class.

Related architecture:

- [What Counts As A Tool](../tools-and-accomodations/architecture.md#what-counts-as-a-tool) — the eligibility / content-dependency / placement split this PRD applies to audio
- [Sign Language (ASL) Support](./sign-language-asl-support.md) — the same three-part shape, already implemented; this PRD is its second instance
- [Accessibility Catalogs Integration Guide](../accessibility/accessibility-catalogs-integration-guide.md)
- [Accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md)
- [Media asset contract](./shared-contracts/media-asset-contract.md) — for the recorded-audio card form

Source material (Confluence): [Audio Transcript](https://illuminate.atlassian.net/wiki/spaces/REN/pages/19563380928/Audio+Transcript) states the transcript requirement and why it must be accommodation-gated rather than universal. [Audio Autoplay — Item Inventory & Technical Fix](https://illuminate.atlassian.net/wiki/spaces/TLSF/pages/19366314414/Audio+Autoplay+Item+Inventory+Technical+Fix) inventories ~1,200 affected Star items and asks, as an open item, whether PIE has an equivalent of Learnosity's `Enable` action. This PRD answers that question and proposes where the missing half belongs.

## Problem

Star Early Literacy delivers prompts as recorded audio with no on-screen text, because it targets pre-readers. Some states hold that WCAG's audio-transcript requirement applies, so affected items carry an `audio_transcript` property that must appear before the audio player — but **only for students identified as needing it.** Universal display would break three item families outright: audio-only items aimed at pre-readers, letter-sound items ("which letter makes the /s/ sound"), and any listening-comprehension item, where showing the passage as text changes the construct being measured.

That is an accommodation, and PIE has the machinery for accommodations — the machinery signing uses. The shipping implementation predates it.

**Today, in `pie-elements-ng` `mc-populated-blank`:** delivery renders `model.audioTranscript` into the DOM unconditionally and decides only whether it is *visible*, from `el.closest('.rli-with-audio-transcript')` — a class the host places on an ancestor, watched with a `MutationObserver` over every ancestor's `class` attribute. It works, and it was the right way to ship before the toolkit existed. Its costs are now real:

1. **The decision is invisible to policy.** No support id is consulted, so district, test-administration, and item-level precedence cannot reach it, and the PNP debugger cannot show it. The accommodation exists but is unauditable.
2. **Every element with audio reimplements it.** The sniff, the observer, and the `sr-only` convention are per-element code.
3. **There are already two mechanisms, and the model one is dead.** The controller computes `showVisibleTranscript` (`controller/index.ts:210`); delivery shadows it with `const showVisibleTranscript = $derived(ancestorHasTranscriptClass)`. Whatever the model says is discarded at render.
4. **The gate is visual, not informational.** When not revealed the transcript stays in the DOM as `sr-only`, wired into `aria-describedby`, so assistive technology reads it regardless of the accommodation. For a listening-comprehension item that is the construct the gate exists to protect. See [Open Questions](#open-questions).

**Decided: the class is not carried forward.** An earlier draft of this PRD proposed keeping `.rli-with-audio-transcript` working by having section-player write it. Rejected 2026-08-08 — a DOM class as an accommodation channel does not fit the catalog model, and preserving it would mean two sources of truth for one decision, permanently. The migration path is a **backend content transform** that reshapes affected items into PIE's catalog model — concretely, the Learnosity → PIE mappers in `pie-api-aws` that Star content already flows through, which carried the ASL video into catalogs the same way one commit ago. Legacy shape in, PIE shape out; the runtime learns nothing about either. See [Where The Transform Actually Lives](#where-the-transform-actually-lives).

## Goals

- Represent an audio transcript as an accessibility catalog card, resolved and gated the way every other alternate representation is.
- Give the transcript a policy identity, so eligibility resolves through the existing six-level precedence and appears in the PNP debugger.
- Require **no element awareness of accommodations.** Elements do not read policy, do not sniff classes, and do not decide who sees a transcript.
- Define what the backend transform must emit, precisely enough to implement against.
- Answer whether autoplay needs a policy identity at all, or whether it is a content-variant property the same transform should settle.

## Non-Goals

- No support for `.rli-with-audio-transcript` and no compatibility shim for it. Items are transformed, not accommodated.
- No force-listen gate (blocking answer or advance until playback completes). That is progression control, and it belongs to section-player alongside timed-media gating. Named here only to fence it out.
- No new audio player element, and no change to how an element renders its own audio control in this PRD's scope. See [Where The Audio Itself Should Live](#where-the-audio-itself-should-live) for the direction that would change that, deliberately deferred.

## Package And Export Ownership

- Owning package: `@pie-players/pie-assessment-toolkit` for the support id and decision API; `@pie-players/pie-section-player` for resolving and rendering the transcript region.
- Public export path: existing. `ToolkitCoordinator.decideFeaturePolicy(featureId)` and `AccessibilityCatalogResolver.getAlternative(...)` need no additions.
- Consuming packages or apps: section-player, PNP debugger. `pie-elements-ng` loses code rather than gaining any.
- Runtime environment: browser.
- Outside this repo: the content side lands in `pie-api-aws` — the Learnosity → PIE mappers in `packages/transform/src/ly-pie/` and a backfill command in `dev/cli`. That work is independently shippable and should go first; see [Where The Transform Actually Lives](#where-the-transform-actually-lives).

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

`transcript` is **already** in the toolkit's AfA vocabulary — `packages/assessment-toolkit/src/services/pnp-standard-features.ts:74`, under "visual alternatives for audio", beside `signLanguage`. It is a support id looking for a consumer, which is the same position `sign-language` was in before PIE-880.

It must join the accommodation exclusion list, for the reason the source page gives — a transcript shown to a student who did not need it can invalidate a listening-comprehension item, so inheriting it by default is worse than not having it at all:

```ts
// packages/assessment-toolkit/src/services/defaultPersonalNeedsProfile.ts
export const ACCOMMODATION_ONLY_SUPPORT_IDS: readonly string[] = [
  "signLanguage",
  "transcript",
];
```

### What The Backend Transform Emits

Per audio-bearing model, the transform moves `audio_transcript` out of element model data and into a catalog on that model:

```json
{
  "id": "q1",
  "element": "mc-populated-blank",
  "hasAudio": true,
  "audioUrl": "https://cdn.example.com/sel/q1.mp3",
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

- **`audioTranscript` and `showVisibleTranscript` are dropped from the model.** The text lives in exactly one place. An item that still carries them is a partially-transformed item, and the element should stop reading them in the same release.
- **The catalog identifier is opaque to PIE, but not arbitrary for the transform.** Nothing in PIE parses, prefixes or slugs it, per the repo's identifier rule — round-trip it byte-for-byte. The transform still needs it *deterministic*, because the backfill recognises its own previous output by it, so the shipped convention is `${modelId}-transcript` and the examples above use it.
- **`data-catalog-idref` docking is optional here, and usually impossible.** This is the one structural difference from signing: an audio prompt is not authored markup, it is a model field (`audioUrl`), so for the audio-only items that need transcripts most there is no author-written node to dock to — `sentenceHtml` is empty by design for pre-readers. The card therefore resolves by **owner scope** rather than by docking: the player collects catalogs registered for the item that carry a card of the requested type, exactly as `collectSignLanguageCatalogRefs` does for signing, and resolves through `getAlternative` from there. That mechanism already exists and should be generalized by catalog type rather than copied.

### Where The Transform Actually Lives

Star content reaches PIE through the Learnosity → PIE transform in `pie-api-aws`, so "backend content transform" above is not a new pipeline to build — it is an existing one to extend, in `packages/transform/src/ly-pie/`.

The transcript's blast radius there is one mapper. `question.data.audio_transcript` is read in exactly one place, `map-ly-custom.ts:70`, reached only by the custom types `sel_r1*`, `sel_vic*` and `sr-vic*`, all of which map to `mc-populated-blank` — which matches the element-side finding that `mc-populated-blank` is the only element implementing the transcript. Ten lines below, inside `if (model.hasAudio)`, `showVisibleTranscript` is set from `getTranscriptVisibilityDefault(layoutProfile)`: `false` for `audio_blank_only`, `stimulus_image_blank` and `token_sequence`, `true` otherwise.

That helper is worth naming as the root of the problem this PRD fixes. **Whether a transcript is visible is already being decided at import time, from the item's layout profile** — and layout is not a statement about a student's needs. Any rule of that shape is guessing at an accommodation from content shape, which is what a PNP profile exists to stop. `getTranscriptVisibilityDefault` disappears with the field; nothing replaces it, because the decision moves to policy.

`ly-sign-language.ts` (PIE-881, commit `621f351d`) is the precedent to follow, and it did most of the groundwork:

- The catalog *shapes* already exist there: `ly-pie/pie-types.ts` declares `AccessibilityCatalog`, `AccessibilityCatalogCard`, `SignLanguageCatalogCard` and `TextCatalogCard`, restated locally rather than imported — `pie-api-aws` depends on neither the player nor the element repo, and fixture parity is the drift protection. No model type declares an `accessibilityCatalogs` field; the write lands through `PieModel`'s `[key: string]: any` index signature, which is worth knowing because nothing type-checks the field name at the assignment. A transcript card is a new card type in a structure that already ships.
- Same module shape: a cheap substring bail-out before any parsing, one catalog per source artifact, identifiers round-tripped byte-for-byte.
- **Unlike signing, no docking node is written.** The signing transform replaces an inline `videoplayer` feature span in the prompt with a hidden `data-catalog-idref` node, because the video *was* in the markup and leaving it there would render it ungated to everyone. An audio prompt is never in the markup — it arrives as `question.data.audio` and becomes `model.audioUrl` — so there is nothing to remove and nowhere to dock. This is the source-data cause of the owner-scope resolution decided above, not a preference.

The field cutover needs a compatibility bridge, and the signing import's `emitLegacyContentUrl` is the cautionary version of one rather than the model to copy. It wrote the video URL into the card's `content` on the premise that pie-players accepted a bare URL there. That was true when written and PIE-880 then made structured media the only accepted form, so the bridge became one console warning per imported card and nothing honoured the field — a bridge whose far end moved. It is now off by default. The lesson the transcript bridge takes from it is that a bridge is only safe while something verifies the far end still exists, which is what the fixture-parity tests are for. So `emitLegacyTranscriptFields` is on by default: emit the catalog card **and** keep `audioTranscript` / `showVisibleTranscript` on the model until section-player renders the region, then flip it off. Additive first, destructive later, one flag naming the moment.

**Written 2026-08-08 in `pie-api-aws`, not yet committed.** `ly-audio-transcript.ts` exports `applyAudioTranscriptCatalog(model, opts)`, hooked in `map.ts` beside `applySignLanguageCatalogs` and after the model-id rewrite, since the catalog identifier is derived from the id the item ships with. It reads the *mapped model* rather than the raw question, so one hook covers every mapper that carries audio instead of `map-ly-custom` growing accommodation logic. `MapLearnosityToPieOptions.transcript` carries the options. 13 unit tests, real SEL item as fixture; `getTranscriptVisibilityDefault` still stands because the field it feeds is still emitted under the bridge.

### Re-Transforming Items Already In PIE Form

Two populations, and only one of them needs a new command.

Items re-imported from Learnosity source need nothing new: `json-imports:transform-learnosity-items` (`dev/cli/src/commands/json-imports/transform-learnosity-items.ts`) already runs the full mapper set over JSON or JSONL with `--dryRun`, per-type statistics and an error log, so a transform change reaches them by re-running it.

Items **already stored in PIE form** are the gap: they hold `audioTranscript` on the model and no catalog, and re-deriving them from Learnosity is not always available or desirable.

**Implemented: `cms:items:backfill-audio-transcript-catalogs`** (`dev/cli/src/commands/cms/items/`). Takes a file of item ids, fetches in batches through `getItemModel()`, runs the *same* `applyAudioTranscriptCatalog` the importer runs — so there is one definition of what a transcript card looks like — and writes only models it actually changed. `--dryRun` reports without writing; `--dropLegacyFields` is the per-run form of flipping the bridge off, with its own warning in the flag help.

Filed under `cms/items/` rather than `tickets/` deliberately: the ticket folders hold one-off scripts, and this is idempotent, re-runnable, and needed again every time content lands from a pipeline that has not been updated yet.

Two requirements it is built around, both easy to get wrong:

- **Idempotent.** Re-running finds a transcript card already present and writes nothing, rather than appending a second transcript catalog. Detection is by card *type*, not by identifier, so a transcript authored under some other identifier also counts — two transcripts for one audio prompt would leave a player picking one.
- **Silent on items without a transcript.** No catalog field, no model rewrite, byte-identical output — the same discipline `extractSignLanguageFromPrompt` applies by returning `undefined` early. A whitespace-only transcript counts as none.

One deployment detail: `dev/cli/oclif.manifest.json` is tracked and is what the built CLI resolves commands from, so a new command is invisible until it is listed there. It is updated in this change — the new command's entry added, and the stale `tickets:pie182:…` entry dropped. That entry is worth a note: `oclif manifest` builds from `dist/`, not `src/`, so compiled output for a deleted command resurrects its manifest entry on the next regeneration. Clearing the orphaned `dist/commands` output is part of removing a command.

### Rendering: A Region, Not An Element Concern

`pie-elements-ng` has no dependency on `@pie-players/pie-assessment-toolkit` and consumes no toolkit context anywhere — verified across the whole repo. So an element *cannot* read a policy decision today, and giving it one would create an element→toolkit coupling the architecture has deliberately avoided: elements render content, the player owns accommodations. That is the same boundary the signing region was built to respect.

So the transcript renders as a **card-level region in `SectionItemCard.svelte`**, beside the existing `header`, `content`, and `media` regions — reusing the resolve-then-gate path the media region established, with two differences: the content is a string rather than media, and the region stacks **above** the item content rather than beside it, so reading order is header → transcript → audio prompt.

That placement satisfies the source page's "text appears before the audio player" in reading order, at item granularity rather than immediately-adjacent granularity. Whether item granularity is acceptable is an open question for the requirement's owner — it is the one thing lost by keeping accommodations out of elements, and it is worth confirming before building.

### Where The Audio Itself Should Live

The end-state this points at, recorded now and deliberately not proposed for implementation: an audio prompt is itself an alternate-representation-shaped thing. If `spoken` gains the recorded-audio payload form already noted in the [signing PRD's open questions](./sign-language-asl-support.md#open-questions), then one docking node carries three cards — `spoken` (recorded audio), `transcript` (text), `sign-language` (video) — each gated by its own support id, all rendered by the player, and elements own no accommodation media at all. Autoplay becomes a player concern at the same moment, which is what would finally give the app-level override somewhere to live.

The cost is that early-literacy layout moves into the player: `mc-populated-blank` currently places its Listen button inside the item layout (`layoutProfile: 'audio_blank_only'`, feature-button skins, inline sentence audio), and the autoplay page already flags Listen-button UX as unscoped. That is a content and UX programme, not a refactor. This PRD stays compatible with it: nothing proposed here adds element coupling, so the larger move remains open.

## Compatibility

This PRD touches:

- **PIE element runtime/controller contracts.** `pie-elements-ng` `mc-populated-blank` loses `audioTranscript` / `showVisibleTranscript` from its model, and loses the class sniff, the ancestor `MutationObserver`, and the `sr-only` transcript node. Its `Print.svelte` transcript rendering needs a replacement path, since print has no toolkit region — see Open Questions.
- **The Learnosity → PIE transform in `pie-api-aws`.** A catalog card replaces two model fields once the bridge flips, and `getTranscriptVisibilityDefault` is deleted with them. Autoplay adds a layer rather than changing one: the legacy tag rule stays, so nothing moves until a program supplies a `byCollection` map. Fixture parity with this repo's card shape is the only thing keeping the two sides in agreement, since neither repo imports the other's types.
- **Persisted/authored wire data.** Authored items change shape, by transform, in the backend pipeline. Items must not be half-transformed: the element stops reading the old fields in the same release the transform stops emitting them, or the transcript silently disappears for the population that needs it. The `emitLegacyTranscriptFields` flag is what makes that a scheduled flip rather than a race.
- **Contract attributes.** Adds one `data-region="transcript"` (name to settle) on the item card. Removes PIE's dependence on `.rli-with-audio-transcript`; hosts may keep writing it, it simply stops meaning anything.

It must not change versioned `pie-*` tag names, `pie-item-player` properties/events/methods, section completion state, or assessment-player routing.

## Data Ownership And Host Responsibilities

PIE owns: the support-id vocabulary, precedence evaluation, catalog resolution, the region and its accessible wiring.

Hosts own: which students have the accommodation, transcript text and audio assets, and the program-level decision about autoplay.

The content transform that produces PIE-shaped items is host-side but not third-party — it is Renaissance's own `pie-api-aws` pipeline, which is why this PRD can name its files and why the transform half can be specified rather than merely required. That is a convenience of ownership, not a boundary change: nothing in PIE may assume the transform ran.

## Serialization And Versioning

No new persisted or wire-facing types. The transcript card is `CatalogCard` unchanged; the removal of two model fields is a content-pipeline migration, not a schema version bump. Round-trip fixtures should cover one real transformed SEL item, since the transform is where this can silently go wrong.

## Accessibility

- An accommodation currently gated by an undocumented class becomes gated by the student's profile, at the right precedence, auditable in the debugger.
- The transcript must be programmatically associated with the audio it transcribes. With the region no longer inside the element, `aria-describedby` across that boundary needs an explicit id contract — the item card knows the region's id, the element owns the audio node, and nothing currently connects them. This is the accessibility detail most likely to be lost in implementation.
- Revealing the transcript must not move focus.
- Whether an ungranted transcript should remain in the accessibility tree is the open question below. Today it does.

## Standards Or Adapter Impact

`transcript` is an AfA/PNP 3.0 support token and QTI 3 carries transcript-style alternates as catalog cards, so the mapping is free — but as with signing, QTI is inspiration rather than an interop target and no conformance is claimed. Autoplay has no standards token; AfA's nearest neighbour is `audioControl`.

## Test Plan

Required test coverage:

- feature-decision tests for `transcript` across all six precedence levels, mirroring `tests/policy/sign-language-feature-policy.test.ts`;
- a regression test pinning that `transcript` stays out of `computeDefaultSupports()`;
- resolver tests for a `transcript` card resolved by owner scope with no `data-catalog-idref` present — the case signing never exercises;
- section-player tests for granted / not-granted / granted-but-no-card, and for reading order placing the transcript before the audio;
- an accessibility test asserting the transcript is associated with its audio across the region boundary;
- a transform fixture: one real SEL item before and after, asserting the text moved and the old model fields are gone.

In `pie-api-aws`, alongside `test/ly-pie/map-sign-language.unit.spec.ts` which the ASL import established as the pattern:

- a real SEL item as fixture, asserting the emitted card's shape matches this repo's `CatalogCard` exactly — the fixture is the only thing preventing drift between two repos that share no types;
- both flag states: card plus legacy fields, and card alone;
- an item with audio and no `audio_transcript`, asserting byte-identical output;
- backfill idempotency: running it twice yields one catalog, not two;
- for the autoplay policy: both fixtures' legacy answers unchanged with no options, one collection named in each direction, exact-token matching, a `STARcollectionMulti`-only item, and a conflicting policy leaving the legacy value and reporting.

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

1. **`pie-api-aws`, additive — written 2026-08-08, uncommitted.** The import emits the `transcript` catalog card *and*, with `emitLegacyTranscriptFields` on, keeps `audioTranscript` / `showVisibleTranscript`. The backfill command does the same for items already in PIE form. Delivery is byte-for-byte unchanged in behaviour — the element still reads the fields it always read, and the new card is inert data nothing looks at yet. Shippable on its own.
2. **`pie-players`.** Support id in the exclusion list, owner-scope resolution generalized by catalog type, the region in `SectionItemCard.svelte`. Students granted `transcript` now get it from the card; everyone else is unaffected. Content transformed in step 1 already carries what this needs.
3. **`pie-api-aws` + `pie-elements-ng`, destructive.** Flip `emitLegacyTranscriptFields` off, re-run the backfill, and remove the field read, the class sniff, the ancestor `MutationObserver`, and the `sr-only` node from `mc-populated-blank`. Only now is the class dead.

The one hard precondition, and it sits between steps 2 and 3: **the affected population's profiles must grant `transcript` before step 3 removes the old path.** Until then the class is what is actually delivering the accommodation. Getting that backwards is the silent-failure mode this PRD's release risk names, and it is a data question, not a code one.

Print is not in any of the three steps, because there is no decided answer for it yet — see Open Questions. If step 3 lands before print has one, print loses the transcript.

## Answering The Autoplay Page's Open Item

Its open item #3 asks whether PIE supports the equivalent of Learnosity's `Enable` action. It does, at the item level, already:

| Learnosity behavior | PIE today |
| --- | --- |
| `Play` (broken): audio autoplays, Listen button disappears, no replay | Not reachable. `AudioPlayer.svelte` renders a permanent control in both of its modes — a Listen button in `feature-button` mode, native `<audio controls>` in `controls` mode. Neither can vanish after playing. |
| `Enable` (the fix): Listen button present, autoplay follows the app setting | `autoplayEnabled` prop plus a permanent Listen button — same behavior. |
| Browser refuses programmatic playback | Partly handled, and worth fixing: the `blocked` state is derived in both modes, but the "click to enable autoplay" affordance is rendered only inside the `controls` branch. The SEL layout profiles this PRD is about select `feature-button` (`useFeatureButtonAudio: true`), so for exactly those items a blocked autoplay currently surfaces nothing. Learnosity's model has no equivalent either way. |
| App-level setting overrides the item | **Missing**, and probably misframed — see below. |

The per-item template edits that page costs at 14–28 hours per product are fixing a Learnosity-only defect; PIE items do not have it. Worth raising before ~1,200 items are hand-edited on the assumption both players need the same fix.

On the missing row: the page has autoplay going *both* ways by product — FAST SR wants it ON for the general population, SR PK12 may want it OFF — which is a property of the program, not of a student's needs. So the content transform is the natural home. It is also, it turns out, the existing one.

### Autoplay Is Already A Transform Property

`autoplayAudioEnabled` is not a field waiting to be filled in. The Learnosity transform already derives it per item from the item's tags, in `getAutoplayAudioEnabledFromTags` (`packages/transform/src/ly-pie/shared.ts`), called from twelve mappers — custom, mcq, association, classification, clozeassociation, clozedropdown, clozetext, gridded, graphplotting, hotspot, imageclozeassociationV2, numberlineplot. The rule is: autoplay is on when the first value of the item's `rli-kas:STARcollection` tag contains `READING` or `MATH`.

That rule is where the page's ON-for-one-product, OFF-for-another requirement currently dies. The real tag values in the transform's own fixtures are `STARCOL_STARMATH`, `STARCOL_STARMATHFAST`, `STARCOL_STARREADING`, `STARCOL_STARREADINGFAST`, `STARCOL_STARREADINGK12`, `STARCOL_STARREADINGLSY`, `STARCOL_Science` and `OTHER_COLLECTION`. **The program variants the page wants to distinguish are already distinct in the data** — `STARCOL_STARREADINGFAST` versus `STARCOL_STARREADINGK12` — and the substring test collapses them, so today both get autoplay ON.

**Written additively 2026-08-08, uncommitted: `ly-autoplay-audio.ts`.** The substring rule is untouched and keeps producing what it always produced; `applyAutoplayAudioPolicy` runs after the mappers and overrides the result only for collection tokens a caller has explicitly named, through `MapLearnosityToPieOptions.autoplay.byCollection`. So with no options every item imports byte-identically, a program migrates by being named one token at a time, and unnamed collections keep the legacy answer — the two rules coexist rather than one cutting the other over. That matters because "OFF for SR PK12" is still the open product question below; the mechanism can land before the answer does. Once every collection in the bank is named, the substring rule is dead code.

Two properties worth knowing:

- **Tokens match exactly**, which is the whole point — no more deciding on substrings.
- **Conflicts are reported, not guessed.** An item shared by a program that wants autoplay and one that does not has no correct single answer at import; the legacy value stands and the item is recorded on `LearnosityToPieMappingLog.autoplayPolicyConflicts` for a human to decide.

The additive path also declines to inherit two defects in the legacy helper, both of which silently produce autoplay OFF on items that should have it. They are left in place rather than fixed, because fixing them moves live content underneath itself in the same breath as an open product question:

- **`rli-kas:STARcollectionMulti` is invisible to it.** `isStar` accepts either the `STARcollection` or the `STARcollectionMulti` tag, but `getTagKeyByName` matches tag keys by *suffix*, and `…Multi` does not end in `starcollection`. An item whose collections are recorded only in the multi tag is treated as Star content everywhere else and gets `autoplayAudioEnabled: false`. Latent rather than observed — no sampled fixture is multi-only.
- **Only the first array value is read.** `tags[key][0]` decides for an item in several collections, so membership order silently picks the answer. `getCompleteAudioEnabledFromTags` (the `READING`-only rule behind `completeAudioEnabled`) has both defects identically, and no additive path yet.

The policy path reads every value of both tags, so an item reachable only through the multi tag is addressable by policy even though its legacy answer stays what it has always been.

So the question to settle is unchanged: **is runtime-adjustable autoplay a requirement, or is per-program content the answer?** A policy id is justified only if a *teacher or district* must change autoplay at delivery time (Star Math has such a setting, Star Reading does not, per the page). If per-program content is the answer, this half is already built and closes with nothing at all in PIE — only a `byCollection` map per program.

## Open Questions

- **Is item-granular placement acceptable for the transcript?** Keeping accommodations out of elements means the transcript renders above the item content, not immediately above the audio control inside the element's layout. Reading order is preserved; adjacency is not. Needs the requirement owner's confirmation, since the alternative is element→toolkit coupling.
- **Should an ungranted transcript be in the accessibility tree?** Today it is: `sr-only` plus `aria-describedby`, so screen-reader users get the text whether or not the accommodation was granted. That may be intentional, but it makes the gate visual rather than informational, and for listening-comprehension items it is the construct risk the source page is written to avoid. Content and psychometrics call, not engineering.
- **Print.** `Print.svelte` renders `model.audioTranscript` directly, and print has no toolkit region or policy context. Either the print path keeps a model field the delivery path no longer has, or print gains a way to receive the resolved card. Unresolved, and easy to miss because print is a separate build.
- **Passages.** The source page also wants transcripts on passages, between title and body. `SectionPassageCard.svelte` would need the same region — which is the third time the item/passage card duplication has been a cost, and an argument for finally factoring the shared shape.
- **Is runtime-adjustable autoplay required?** See above. If not, the autoplay half is a transform, not a feature.
- **Resolved: the card's `language` needs a format conversion, not a new source.** The transform already knows the item's language — `getLocale` and `getLanguageFromTags` yield the `locale` field, though only `map-ly-custom` actually sets it, which is sufficient today because that is the only mapper carrying transcripts — but in POSIX form, `en_US` and `es_ES`. `AccessibilityCatalogResolver` matches `card.language` with strict equality against a BCP-47 request and a default of `en-US`, so a card emitted as `es_ES` matches no request; it would surface only through the no-language-constraint fallback rung, which is resolution by accident. The transform must emit `es-ES`. Cheap, and exactly the kind of thing that works in every test written against one language.
