---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
---

Match catalog card languages by BCP-47 lookup, and fix lazy locale loading under Node.

Catalog language matching was strict string equality, so a card the Learnosity
transform emits as POSIX `es_ES` matched no request for BCP-47 `es-ES`. It
surfaced only through the final no-language-constraint rung, and only when nothing
else of its type existed — with an English card also present the Spanish one was
unreachable. `es-MX` likewise never reached a card tagged plain `es`. This is the
defect the audio-accommodations PRD describes as resolution by accident, and it is
the shape that passes every test written against one language.

`@pie-players/pie-players-shared/i18n/language-tags` is a new entry point carrying
`normalizeLanguageTag`, `languageTagsEqual`, `languageTagLookupSequence` and
`findBestLanguageMatch`. It holds no locale data and touches no DOM, and it is
deliberately not reachable through `./i18n`, whose index re-exports the loader and
therefore pulls the eagerly-bundled English catalog — the catalog resolver and TTS
voice selection both need tag matching and neither wants a message catalog.

`AccessibilityCatalogResolver` now expands each requested tag into its RFC 4647
lookup sequence, one rung per truncation, preserving the existing most-specific-first
ordering and the rule that form is preferred within a language rung and never
across one. A sibling region is still never substituted: `es-ES` is not an answer
to an `es-MX` request, because offering the wrong locale is worse than offering
nothing. `getAllAlternatives` keys on the normalized tag, so two syntaxes of one
language collapse into the single alternate resolution can actually return rather
than reporting two.

Separately, `loadTranslations` could only ever load English. The static English
imports carried `with { type: "json" }` and the lazy per-locale imports did not,
so Node's ESM loader rejected every other locale with
`ERR_IMPORT_ATTRIBUTE_MISSING` — which the surrounding `catch` reported as
"Translation files not found", sending readers to look for files that were sitting
in `dist` the whole time. Bundlers infer the type from the extension and so were
unaffected, which is why English-only use never showed it, but `players-shared` is
on the publish policy's `nodeSafe` list. The attributes are now present on every
import and the failure preserves its `cause` instead of substituting a misleading
message.

`I18nService` was a near-verbatim second copy of `SimpleI18n` — same fields, same
lookup chain, same `selectPluralForm` — and is now a delegating wrapper that adds
only the toolkit's logging and `initialize()`. `detectBrowserLocale` is exported
from `players-shared` and has one implementation instead of two. Both public entry
points behave as before.
