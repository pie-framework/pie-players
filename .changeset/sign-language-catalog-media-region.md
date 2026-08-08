---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-theme": patch
---

Render `sign-language` accessibility catalog cards. `sign-language` has been a declared `CatalogType` with no consumer since catalogs landed — only `spoken` was wired, through `TTSService` — so an item carrying an ASL video showed the question and no video. This adds the four pieces that make signed alternates appear, deliberately shaped as a second instance of the spoken/TTS path rather than as new machinery.

## Card payload

`CatalogCard.content` is a flat string, so a signing card could only hold a bare URL — no second source, no MIME type, no poster, no time range, all of which QTI 3 expresses inside `qti-card-entry`. `CatalogCard` gains an optional typed `payload`, and `players-shared` gains the media vocabulary it uses (`MediaAssetRef`, `MediaSource`, `TextTrackRef`, `TranscriptRef`, `MediaFragmentRange`, `SignLanguageCardPayload`).

One media vocabulary, not two: `MediaAssetRef` is defined against both this consumer and prospective stimulus media, with the required subset resolved per consumer instead of by making every field optional at the type level. For signing, sources and language are required, poster and duration do not apply, and `tracks`/`transcript` are actively meaningless — captions on a signing video would be the English text already on screen. Stated so no future policy adds a caption requirement to signed content.

Additive throughout. `content` stays required and stays populated with the primary source URL, which is also the legacy single-source form, so a consumer reading only `content` degrades to "the right video, fewer details" rather than to an empty string. Existing bare-URL `sign-language` cards keep resolving; `resolveSignLanguageMedia` treats them as the legacy form rather than rejecting them.

Validation is "treat as absent, never as text": a payload with no usable source resolves to `null` instead of rendering an empty player or a URL as visible content. Source URLs are restricted to schemes a media element can actually fetch, so an authored `javascript:` or `file:` URL cannot ride into the DOM.

## Extraction

`SignLanguageExtractor` is the signing counterpart of `SSMLExtractor` and exists for the same reason: authors carry the accessibility material inline, and the runtime needs catalog cards. It probes content for `data-sign-language` regions, lifts the video into a card with sources, poster and an optional `data-sign-language-start` / `-end` range, removes it from the visible markup, and docks the catalog on the content it translates via `data-catalog-idref`.

Removing the video from visible content is the substantive divergence from Learnosity, where a signing video is ordinary item content that renders unconditionally with nothing to gate. In PIE it becomes catalog data that policy decides on.

An existing `data-catalog-idref` is never overwritten. The attribute is one canonical name with two readers, and clobbering it would break TTS resolution for that node; the synthesized catalog is still emitted and still resolves, because the region finds cards through the item's catalog set rather than by walking the DOM.

## Resolution

Lookup goes through `AccessibilityCatalogResolver.getAlternative(catalogId, { type: "sign-language", language })`, so assessment/item/scoped priority and owner scoping are not re-implemented. `ResolvedCatalog` now carries the card's `payload`.

One behaviour is deliberately stricter than the resolver's default. Its last fallback rung matches any card of the requested type regardless of language, which is helpful for spoken content and wrong for signing: ASL, BSL and LSF are not interchangeable, so handing an ASL learner a BSL recording is worse than handing them nothing. A card reached by that rung is accepted only if its language matches, or if it asserts no language at all — the unlabelled legacy case, rejected only if we would rather make existing content dead than render it.

## Policy

Signing is gated on the `signLanguage` PNP support id through the existing six-level `PnpPolicySource` precedence. Because the region is not a toolbar surface, a placement-scoped `decide(...)` would answer the wrong question — absent because it was never placed, not because policy said no — so `ToolPolicyEngine.decideFeature(featureId)` and `ToolkitCoordinator.decideFeaturePolicy(featureId)` resolve one feature id independent of placement. `PnpPolicySource.resolveFeature(...)` reuses the existing rule evaluation rather than copying the six levels, so the two cannot drift.

`pnpEnforcement` is not consulted for a feature decision: that flag governs whether profile policy *refines* an otherwise-visible tool set, and a feature with no placement has no unrefined baseline to fall back to, so skipping the profile read would make the accommodation permanently unavailable rather than merely unrefined.

`computeDefaultSupports()` now excludes `ACCOMMODATION_ONLY_SUPPORT_IDS`, which lists `signLanguage`. That function derives the fallback profile from every registered tool's `pnpSupportIds`, which is right for universal features and wrong for an accommodation: signing requires a documented need, so inheriting it by default would invert the eligibility tier. Excluded by id rather than by declining to register, so the guarantee holds however a signing tool later reaches the registry. Hosts that supply their own profile are unaffected.

## Region

`SectionItemCard.svelte` gains a `data-region="media"` region beside its existing `header` and `content` regions, holding a resolved catalog card. Named for the slot rather than its first tenant — audio description is the same "docked alternate media, gated by PNP" shape.

`item-player` needs no changes and learns nothing about signing.

- **Fixed to the right of the content.** Not below: signing is re-checked *while* an answer is being formed, so a bottom placement means scrolling between video and choices repeatedly. Side by side keeps both visible however long the item is, and the region is sticky within the card so it follows a long question down. Being parallel rather than sequential also sidesteps a problem an above/below split cannot solve, since `item-player` renders prompt and choices as one opaque block.
- **Resizable** via a keyboard-accessible `role="separator"` divider following `SectionSplitDivider.svelte`'s shape rather than reusing it — that component is wired to the passage/items grid and converts a drag with a fixed 0.1%-per-pixel factor. Inside a card the same drag has to mean the same thing whether the card is wide or narrow, so the math here is container-relative.
- **Sized for legibility** by an aspect-ratio target with a height floor, not a flat width percentage, which either wastes space on a short clip or crushes signing on a narrow device. Retunable via `--pie-section-player-item-media-aspect-ratio`, `--pie-section-player-item-media-min-height` and `--pie-section-player-item-media-max-height`. Below a 560px card width the region stacks and the divider withdraws.
- No orientation toggle and no free repositioning. Free 2D positioning is the floating-tool pattern, built for movable utility windows; the `toolParameters` seam is the right place for a policy-driven generalization, and nothing hangs there yet.

The split wrapper is always present and the content region always occupies the same slot within it, so a card resolving after mount adds siblings rather than re-creating the item player. An item with no signing markup comes back from extraction by reference, so nothing downstream sees config churn.

Playback is a minimal `<video>` wrapper: the clips are seconds long, so sharing a player with a section-scale stimulus element buys nothing. Its own audio is muted by default, its accessible name states the language ("American Sign Language") rather than saying "video", and starting it pauses TTS — the action the learner just took wins.

## Availability

Signing appears when **both** conditions hold: the item carries a matching card, and policy grants eligibility. Both are checked independently and neither is a default. The content half is AfA's resource-side declaration (QTI approximates DRD in-band — the presence of a card *is* the declaration) and is what keeps the region off the overwhelming majority of items, so a learner with the accommodation still sees no dead affordance where no signing was authored.

## Also

`AssessmentSection` gains an optional `personalNeedsProfile`. Section players already read it (falling back to `settings.personalNeedsProfile`, then to the computed default) through an `any` cast; this types an existing runtime contract.
