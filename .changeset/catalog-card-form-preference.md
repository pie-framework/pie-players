---
"@pie-players/pie-assessment-toolkit": patch
---

Make a script and a recording of it addressable on the same node.

A `spoken` node can legitimately carry two cards in the same language: the
reading script, and a recording of it. That is APIP's authoring pattern, and QTI
3's migration guidance keeps the script when legacy audio moves into catalogs,
because it is both the source the audio was generated from and the fallback when
the audio cannot play. PIE could store both and resolve neither reliably: both
rungs of `findMatchingCard` took the first card matching type and language, and
`getAllAlternatives` deduped on type and language alone, so whichever card was
written second was unreachable and enumeration under-reported it — with no
diagnostic, the same silent-no-op shape as the withdrawn `signLanguage` alias.

`CatalogLookupOptions` gains `form?: "content" | "payload"`. No new field on the
card: a card carries exactly one of `content` or `payload`, so the slot it fills
is already an unambiguous discriminator, and `catalogCardForm(card)` names it.
`form` is a preference rather than a filter — an absent preferred form still
returns the other card, so callers check what they got, as they already must for
a card of an unexpected type. It applies *within* a language rung and never
across one, so a Spanish lookup is never answered with English audio in
preference to Spanish text. Omitting it preserves first-match resolution exactly.

`getAllAlternatives` now keys on type, language and form, so both cards are
reported. `TTSService`'s three spoken lookups ask for `form: "content"`
explicitly, so which card an item lists first cannot change what read-aloud
speaks.
