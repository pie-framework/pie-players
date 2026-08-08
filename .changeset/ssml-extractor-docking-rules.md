---
"@pie-players/pie-assessment-toolkit": patch
---

One docking rule for both catalog extractors, and no synthesized content to hold a reference.

`data-catalog-idref` is a single canonical attribute naming a whole card array, with more than one reader now that signed alternates render. `SSMLExtractor` was overwriting it unconditionally on whatever element wrapped an inline `<speak>` — usually an element the author wrote. When that element already carried a reference, the authored one was silently replaced, taking every card under it out of reach: not just the spoken alternate the extractor cares about, but that node's braille, simplified-language and sign-language cards too. `SignLanguageExtractor` already refused to overwrite; both now follow the same rule. `SSMLExtractor` also reports the collision; `SignLanguageExtractor` still declines silently, because a signing card is resolved through the item's catalog set rather than by DOM lookup and so loses nothing it was relying on.

Also removed: the invented docking node. Both extractors used to insert a `<span>` when the marked content sat at the root of a fragment, so the reference had somewhere to live — and on the SSML side that span was filled with the `<speak>` element's own text content, which is spoken phrasing, not visible phrasing. Where an author wrote `<speak>x squared, plus two x, equals eight</speak>` as an item's whole markup, that spoken phrasing became the visible content — the documented authoring examples avoid this only because their `<speak>` sits inside a `<div>`, which took the other branch. A `<speak>` or a signing video with no element around it has no content node to be an alternate *for*, so neither extractor now synthesizes one: the catalog is still emitted and still resolves through the item's catalog set, and on the SSML side the missing docking node is reported.

The trade this makes deliberately: a `<speak>` that *is* an item's entire markup now leaves the visible content empty rather than showing spoken phrasing. Sibling visible content is unaffected — a `<speak>` beside a `<p>` removes only the `<speak>`.

Two consequences for authored content, both surfaced as console warnings rather than silent behavior:

- Inline `<speak>` inside an already-docked node no longer applies to TTS. Move the SSML into a `spoken` card on the existing catalog, or give the `<speak>` its own wrapper.
- Root-level inline `<speak>` no longer produces visible text or a docked catalog. Wrap the visible content the SSML speaks in an element.

Authored `accessibilityCatalogs` are unaffected — this is extraction-time behavior only.
