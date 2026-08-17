---
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-players-shared": patch
---

Offer a dictionary per language: `dictionarySpanish` and `pictureDictionarySpanish` join
the packaged set, and the registrations become factories so a host can compose any other
language.

The language of a definition belongs to the learner, not to the content. The base
capabilities take their lookup language from the toolbar's content-alternate language,
which serves the reader who wants a definition in the language they are already reading —
but the learner who needs a Spanish gloss is reading an English passage, and one capability
following the content cannot express that. It also could not be granted separately: the
four support ids on `dictionary` are four names for one grant.

Each variant claims its own PNP support ids — `spanishDictionary`,
`spanishPictureDictionary` and their glossary spellings — and shares none with the base
capabilities, so a programme grants Spanish independently of English in either direction.
Neither variant declares a universal support, on the same grounds as the base capabilities:
a dictionary on a vocabulary item is construct-relevant.

A variant carries its corpus language and that language outranks the content-alternate
language, since a variant that followed the content would be indistinguishable from the
base capability on exactly the content it exists for. A language the host names in the
tool's render params still wins over both, so a host serving `es-MX` specifically can say
so. Both variants render the same elements as the capabilities they vary: two capability
ids, one panel implementation, one module load.

`createDictionaryToolRegistration` and `createPictureDictionaryToolRegistration` are
exported for any other language, taking a `toolId`, `pnpSupportIds`, a `lookupLanguage` and
optionally a `messageKeyPrefix` for a host's own catalogue; a key that does not resolve
falls back to the registration's literal name. `dictionaryToolRegistration` and
`pictureDictionaryToolRegistration` remain exported and unchanged in behaviour, and are
now built from those factories.

Interface strings for both variants ship in every declared locale.
