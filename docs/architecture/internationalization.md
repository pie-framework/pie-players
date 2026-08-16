# Internationalization

Status: `Active` — research and direction. No slice has been scoped to a PRD yet.

Language is three concerns, not one, and every implementation in the PIE estate
conflates at least two of them. Separating them is most of the design work; the
machinery to serve each one already exists somewhere in the estate, in one case
twice.

The three concerns, with the AfA PNP 3.0 field that names each:

| Concern | Whose fact | PNP field | Scope |
|---|---|---|---|
| **Chrome locale** | the deployment | `language-of-interface` | player, toolbar, tool UI, `aria-label`s |
| **Content language** | the authored item | — (declared by content) | item body, prompt, choices, passage |
| **In-item alternates** | the learner | `keyword-translation`, `item-translation`, `sign-language` | a word up to the whole item body |

AfA PNP 3.0 defines `language-of-interface` (§4.1.8), `keyword-translation`
(§4.1.14), `item-translation` (§4.1.17) and `sign-language` (§4.1.18) as four
sibling attributes of the `AccessForAllPNP` root, each `[0..1]` and each typed
`LanguageMode`. QTI 3's implementation guide §5.2.6.3 states the independence
directly: a candidate may choose an interface language "which may or may not
also be the language of the content." The split below is not our invention; it
is the standard's, and we currently model none of it.

## Current state

**`pie-players` has a complete i18n layer with zero call sites.**
`packages/players-shared/src/i18n/` implements `SimpleI18n` with interpolation,
ICU plurals via `Intl.PluralRules`, an RTL locale list, `dir`/`lang` DOM
stamping, a fallback chain and lazy per-locale dynamic imports, against 142 keys
translated to `en`/`es`/`zh`/`ar` at 100% coverage, with a coverage checker and a
hardcoded-string scanner. `packages/assessment-toolkit/src/services/I18nService.ts`
is a near-verbatim duplicate. Both are published; neither is instantiated
anywhere. The `useI18n(() => player.getI18nService())` pattern in the README
describes a provider that does not exist, and neither script runs in CI.

Catalog shipping is fine — `src/**/*.json` is in the package's tsconfig
`include`, so `tsc` copies the catalogs into `dist` without a copy step. Lazy
loading was not: the static English imports carried `with { type: "json" }` and
the dynamic ones did not, so under Node's ESM loader every non-English locale
threw `ERR_IMPORT_ATTRIBUTE_MISSING`, which the `catch` rethrew as "Translation
files not found" — pointing at files that were present. English worked, which is
why nothing surfaced it. Fixed, and all four locales now load under plain Node.
`players-shared` is on the publish policy's `nodeSafe` list, so this was a
conformance break and not only a latent one.

The scanner reports 616 hardcoded strings across 141 files, concentrated in
`players-shared` (33), `assessment-toolkit` (29), `section-player` (12) and
`item-player` (8), plus 162 lines carrying `aria-label`. The existing catalog was
harvested from an earlier state of the code and has drifted: nothing covers the
formative feedback strings, `"Passage"`, `"Try again"`, or the sign-language
names.

**`pie-elements-ng` localizes through i18next, keyed on authored content.** 66
`translator.t(` call sites across 15 packages, every one passing
`{ lng: language }` where `language` is a model prop the controller copies off
the authored item. Catalogs are `en`/`es` only, both eagerly imported, and marked
`@auto-generated` from upstream `pie-lib` — edits are overwritten by the sync, so
keys cannot be added there. `packages/elements-svelte/*` has no i18n at all.
Classic `pie-elements` is the same design through `@pie-lib/translator`.

The consequence of keying on `model.language` is that chrome locale is a side
effect of content locale: a Spanish item renders Spanish widget chrome because it
is a Spanish item. That is coherent for wholesale-translated parallel items and
wrong for every other case — an English-chrome deployment showing a Spanish
passage, or a learner wanting Spanish chrome over English content.

**No runtime locale exists in the host→player→element chain.** Not in `Env`
(`mode`, `role`, `partialScoring`), `PieEnvironment`, `RuntimeConfig`,
`AssessmentSettings`, `ItemSettings`, `PersonalNeedsProfile` or `ItemSession`.
The single language input that exists is `accessibility.language` on
`ToolkitCoordinatorConfig`, which feeds the catalog resolver's default and means
content-alternate language.

**The in-item alternate rail already carries language.** `CatalogCard.language`
is QTI's `xml:lang` on the card entry, `AccessibilityCatalogResolver` resolves
through language rungs (exact → default → any), and `CatalogStatistics`
already reports `availableLanguages`. The ASL work established the mechanics that
matter: the card's `language` is the only field resolution selects on, `signLang`
is the language of the *adaptation* and must never be inferred from the item's
content language, and there is deliberately no cross-sign-language fallback.

**Language matching is strict string equality**, and this is a live defect rather
than a gap. `card.language === language`, with no BCP-47 normalization and no
RFC 4647 fallback anywhere in either repo. The audio-accommodations PRD records
the consequence: the Learnosity transform emits POSIX `es_ES`, which matches no
request and surfaces only through the no-constraint rung — resolution by
accident. `pie-elements-ng` carries the same POSIX/BCP-47 split as a hand-written
mapping table, and `pie-qti` needed the same workaround. Three independent
codebases have hand-patched the absence of one function.

**TTS never uses the assessment's language.** Browser voice selection reads
`navigator.language`; `TTSService.applyLanguageSettings()` takes `language` from
the speak call and drives text normalization and segmentation, not voice choice.
`"en-US"` is hardcoded as the fallback in five places.

**`pie-qti` is the reference for the split.** Chrome goes through a hand-rolled
zero-dependency provider; content alternates go through a separate APIP-style
catalog subsystem that reads `xml:lang` (with tolerance for `xmllang` and `lang`),
implements a documented four-step language fallback including prefix matching,
and drives `keyword-translation`, `glossary-on-screen` and `illustrated-glossary`
from the PNP. Its PNP is **parameterized** — `keywordTranslation?: { active: boolean;
languageCode: string }` — which is exactly what our flat `supports: string[]`
cannot express. Its UI locale and content language are deliberately unconnected,
though nowhere documented as intentional.

Three things there are worth not copying. Locale changes call
`window.location.reload()`, which buys real simplicity and costs an inline
English fallback at every one of 153 call sites plus a bespoke scanner to police
the drift. The published `dist` retains Vite's `import.meta.glob` because the
build is plain `tsc`, so importing the provider throws under webpack, esbuild,
Node or plain browser ESM. And pluralization is hardcoded `one`/`other`, so the
shipped Arabic catalog's `zero`/`two`/`few`/`many` forms are unreachable and
Arabic counts render the wrong grammatical form.

**Studio holds the content language and drops it on the way out.** `item.locale`
(`varchar(10)`, default `en_US`) and `item.translation` (a self-FK to
`item(id)`, carried on the *Spanish* row) are real columns with a real
constraint, surfaced through a "Language Equivalents" report and a linked-items
UI. Alongside them runs an informal convention: public IDs are minted
`E257926` → `S257926` by `replace("E","S")`, never validated by a constraint.
Neither `locale` nor `translation` is in the Envers audit table, so there is no
history of linking or relinking.

The QTI export path hardcodes `<language>en</language>` and emits no `xml:lang`
anywhere, so a Spanish item exported to QTI is affirmatively mislabelled as
English. The PIE path does carry `k12_locales` and `k12_languageEquivalent`, but
only in `searchMetaData` — the **PIE item content JSON carries no locale at all**.
The search index knows the language; the player never does. Three further limits:
`k12_languageEquivalent` carries the internal 37-char UUID rather than the public
ID, it is set only on the Spanish side, and passages get the equivalent but never
`k12_locales` because the stimulus mutation has no metadata parameter.

Studio is the ceiling, not PIE. Its `Language` enum is two values, restated
independently in a hardcoded JSP dropdown, the `E`/`S` rule and SQL `CASE`
statements, while PIE's own `k12_locales_ENUM` already accepts the full CLDR list
including `es_419`, `es_MX` and `es_US`. Designing pie-players for two languages
would import a limit only Studio has.

## What the standards do

Verified against 1EdTech primary sources. The Learnosity, TAO, Cambium/TDS,
Smarter Balanced and psychometric-comparability questions did not survive
verification in this pass and are listed as open below rather than reported here.

**A full translation is a separate item.** Consistent across APIP v1.0, AfA PNP
3.0 and QTI 3.0: a wholesale translation is a distinct item file with its own
resource identifier and its own accessibility metadata, never in-item alternate
content. APIP BPI §2.2.3: "Both the English and Spanish versions of the item are
known as variants. Each variant of an item has its own accessibility information
coded within its item XML file." Packaging is a `<variant identifierref="B"/>`
inside resource A plus a sibling resource B. APIP's Appendix A tagging map is
explicit that Item Translation (A13) "Establishes a different variant within the
item package" while Keyword Translation (A14) does not. QTI 3's migration guide
carries it forward verbatim.

Studio's model is essentially APIP variants without the manifest: two item rows
with their own identifiers and a link between them. The gap is not the data model
but that the link and the language never reach delivery.

**In-item alternates are catalog cards, at any granularity.** The chain is
`qti-catalog-info > qti-catalog > qti-card[support] > qti-card-entry[xml:lang]`,
referenced *outward* from body content by `data-catalog-idref` — the reverse of
APIP's direction. Translation content goes in per-language `qti-card-entry`
nodes, not directly in the card. Critically, the implementation guide states that
"any element within the qti-item-body (including the qti-item-body element
itself) can point to a referenced container called a 'catalog'." **The catalog rail
can therefore carry a whole-body translation, not only word-level glosses.** That
is the mechanism that lets us offer more than one content-localization model
without leaving QTI's own vocabulary.

**Language is one accessibility support among peers.** `keyword-translation` sits
in the same enumerated `support` vocabulary as `sign-language`, `spoken`,
`braille` and `linguistic-guidance`, and per-language differentiation uses the
identical `qti-card-entry` discriminant for translation (`xml:lang="es"`) and for
signed alternates (`lang="ase"`). QTI 3.0.1 folds APIP's alternate-content
mechanism into core ASI §2.13 alongside SSML and WAI-ARIA rather than keeping it
a separate profile. This is the strongest argument for language riding our
existing catalog rail rather than getting a subsystem.

**Content language is declared with `xml:lang` on `qti-assessment-item`**,
documented as optional but recommended "as the language is a primary
accessibility support". APIP did the opposite — its own `language` element inside
access features, with `xml:lang` appearing zero times in the Best Practice guide.

**IMS Content Packaging 1.1.4 declares no language of its own**, delegating to
the separate Meta-Data specification. So package-level language variance rides on
LOM `general/language` or AfA `adaptationStatement/language`, not on any CP
construct — relevant to whatever Studio's export should emit.

**Runtime re-resolution against a mutated PNP is proven.** The reference
open-source QTI 3 player applies a language-support change to an already-loaded
item through `setItemContextPnp(pnp)` then `bindCatalog()`, with no XML re-fetch
and no variant swap; `bindCatalog()` takes no arguments and re-resolves DOM
catalog bindings on a mounted item. Rebinding is explicitly *not* automatic on
PNP mutation. Its default PNP literal also shows the type split we need:
`glossaryOnScreen: true` is a boolean toggle, `keywordTranslationLanguage: ''` is
a language code.

**AfA PNP 3.0 is the governing vocabulary.** Where the specs disagree we take the
newer: APIP v1.0 is built on QTI 2.2 bindings and AfA PNP 2.0, while QTI 3.0 uses
AfA PNP 3.0, and 1EdTech's own document set is internally inconsistent about
versions, casing and section numbers. So we code to `item-translation`,
`keyword-translation`, `language-of-interface` and `sign-language` rather than
APIP's `itemTranslationDisplay` and `keyWordTranslations`, and cite APIP v1.0
only as evidence for the variant model it originated. This continues what the
tools-and-accommodations architecture already does in framing
`requiresAuthoredContent` as AfA's DRD half of the PNP/DRD pair.

## Direction

### Language resolution as one policy at three scopes

One BCP-47 tag-matching function with a documented fallback ladder, applied at
three granularities: whole item (form assembly, or variant selection through
`env`), content node (catalog card rungs), and chrome (message catalog lookup).
Same algorithm, same fallback semantics, three scopes.

This is the first slice regardless of which content-localization model anyone
adopts, because all of them need it, and because three codebases have already
paid for its absence with hand-written mapping tables. It replaces
`card.language === language` with RFC 4647 lookup, normalizes POSIX `es_ES` to
`es-ES` on ingest, and gives `es-MX` → `es` → default a defined answer instead of
an accidental one.

It belongs in `players-shared` as a pure function with no DOM and no locale data,
which keeps it inside the `nodeSafe` publish constraint and makes it usable by
the catalog resolver, the TTS voice selector and the chrome layer alike.

### Chrome locale is a composition context

The deployment picks the interface language; no element or item can know it. That
is the exact shape `composition-context.md` describes, and locale belongs in its
table beside theme tokens and granted accommodations, where it is currently
absent.

So: publish one scalar from the player, resolve it property-first then
attribute-then-default, and carry a change signal in the same change that adds
the value. For our own packages the mechanism is `@pie-players/pie-context`; for
PIE elements — third-party, independently versioned, fetched at runtime from a
bundle service — it is a property with a reflected attribute and a
`MutationObserver`, exactly as `baseHeadingLevel` works today. The graceful
default is English with no publisher present, which is what keeps elements
working in Studio preview, authoring harnesses and `print-player`.

Do **not** route chrome locale through `model`. The four arguments in
`composition-context.md` apply verbatim: the publisher does not know its
consumers, the consumer set is open, resolvers must work with no container, and
the value changes after mount. `model.language` is how classic PIE does it and is
why chrome locale is currently a side effect of content locale.

### Content language travels in `env`

`env` is the right channel for content language for the same reason it is the
right channel for `mode`: both are delivery facts that legitimately filter
authored content, and `mode` already drives controllers to filter correct answers
out of the model. Selecting which language variant of authored content to return
is the same operation.

This is not in tension with the previous section. Chrome locale is a fact about
the container that content cannot know; content language is an input to a filter
over authored data. Different facts, different channels, and the reason differs
rather than the convention.

Adding a typed `locale` to `Env` is safe — `consumer-api-dependencies.md` records
that `env` pass-through is load-bearing and that filtering it is forbidden, so an
untyped key already survives the pipeline today. A new custom-element attribute
must be `type: "String"`, given that hosts already pass `show-toolbar` as both
the literal `"false"` and boolean `true` and both must keep working.

Separately, and cheaply: the player should reflect the resolved content language
to `lang`, and direction to `dir`, on the content subtree. Nothing in either repo
writes `dir` today, which is why the Arabic catalog is unreachable dead weight
and why `:lang()`, hyphenation and screen-reader pronunciation cannot work. This
is the highest-leverage slice per unit of effort in the whole document, and it is
blocked only on the item payload carrying a language at all.

### In-item alternates keep the catalog rail, and PNP gains parameters

Language alternates are catalog cards. `keyword-translation`,
`glossary-on-screen` and `language-translation` are QTI's own `support` names, so
adding them is spec-aligned rather than a vendor extension, and `CatalogType` is
already deliberately open. The resolver, the rungs, the owner scoping and the
`data-catalog-idref` docking all already exist; the audio-accommodations PRD
already notes that owner-scope resolution "should be generalized by catalog type
rather than copied."

What does not exist is a way for the learner's profile to say *which* language.
`PersonalNeedsProfile.supports: string[]` cannot carry a parameter, while AfA
types all four language fields as `LanguageMode` and APIP made `language`
mandatory at multiplicity [1] on both `itemTranslationDisplay` and
`keyWordTranslations`. Parameterizing PNP supports is therefore the enabling
change for this layer, and it is a change to a public type under lockstep
versioning — worth scoping deliberately rather than bolting a second field
alongside.

Follow the reference player on the change signal: re-resolution against a mutated
profile should be explicit, not implicit. That also satisfies
`composition-context.md`'s invariant, which two silent failures in this repo have
already earned.

### Four content-localization models, not one

Renaissance content teams produce parallel translated items today, and QTI models
wholesale translation the same way. That is current practice and a standards
alignment, not a constraint the framework should impose. Four models are worth
supporting, and three of them need no new data model:

**Parallel items with a family link.** Today's practice. Each variant separately
calibrated, selected at form assembly, no runtime swap. Needs the content-language
declaration on the payload and a family identifier that survives export —
Studio's self-FK exists but publishes only a UUID, on one side, on a channel the
player does not read.

**Whole-body catalog alternate.** A single `language-translation` card docked at
the item-body level, resolved at runtime against the learner's profile. QTI
permits exactly this, our resolver already implements the selection, and the
reference player proves runtime rebinding without a re-fetch. One item id, one
calibration record — which is a psychometric claim about equivalence that
somebody must actually make.

**Per-node alternates.** `keyword-translation` and glossaries: partial
translation, learner-toggled, PNP-gated. Fully covered by the existing rail once
PNP is parameterized.

**Stacked or side-by-side dual language.** A presentation mode over any of the
first three, not a fourth data model. It needs a region and an arbitration rule,
not a new content shape.

Offering the second model is where we would exceed what Studio emits and what the
QTI export round-trips, so its cost is interop work, not player work.

## Optionality and cost

`pie-qti` demonstrates the mechanism: **every import of its i18n package across
all five consuming packages is `import type`**, fully erased at compile time.
Components declare an optional provider and fall back to an inline English
literal. A host that never constructs a provider ships zero i18n runtime code and
zero locale bundles.

Adopt that, with two corrections. Put the provider in `optionalDependencies` or
`peerDependencies` rather than `dependencies`, which `pie-qti` did not. And
decide the English-source question deliberately: inline fallbacks at every call
site are what make erasure total, and they are also what forced `pie-qti` to
write a scanner to keep 153 sites from drifting. A single English catalog with a
provider that always exists is the opposite trade.

Three constraints bound the packaging:

`players-shared` is built by plain `tsc` and cannot emit chunks. That is
survivable — the catalogs reach `dist` through the tsconfig `include`, and `tsc`
passes dynamic `import()` through untouched for the consumer to bundle or serve —
but it means the package cannot split or fingerprint locale assets itself, and
every JSON import has to carry an explicit `with { type: "json" }` attribute to
stay loadable under Node.

Every player and tool `vite.config.ts` sets `external: []`, so a locale bundle
imported from `players-shared` inlines into each of roughly twenty bundle graphs
unless made external or fetched at runtime.

Tool display names are the hard case. `ToolRegistration.name` and `description`
are required plain strings forming part of the contract a host implements, while
`check:capability-neutrality` forbids core from naming capability ids. There is
therefore no correct home for a per-capability string catalog under the current
ownership split, and this needs a decision rather than a workaround. The
`hooks.cardTitleFormatter` precedent is instructive: a host-owned string override
already exists and is the only thing producing correct question numbers in one
production delivery.

## Rollout

Fixed lockstep patch-only versioning across 36 packages, with two hosts on caret
ranges and one pinned exact. Any change that alters a rendered string reaches live
delivery on those hosts' next install with no build signal on their side. Every
slice below is therefore behaviour-preserving until a host opts in by supplying a
locale.

1. ~~**BCP-47 resolution.**~~ **Done.**
   `@pie-players/pie-players-shared/i18n/language-tags` provides
   `normalizeLanguageTag`, `languageTagsEqual`, `languageTagLookupSequence` and
   `findBestLanguageMatch` — a pure module with no locale data and no DOM, kept
   out of `./i18n` so importing it does not pull the eagerly-bundled English
   catalog. The catalog resolver now expands each requested tag into its RFC 4647
   lookup sequence instead of comparing with `===`, and `getAllAlternatives` keys
   on the normalized tag so two syntaxes of one language collapse to the single
   alternate resolution can actually return. TTS voice selection still reads
   `navigator.language` and is slice 6.
2. **Content language end to end.** `Env.locale`, item payload carries its
   language, player reflects `lang`/`dir` to the content subtree. Requires the
   matching Studio change to emit locale on the PIE content channel and
   `xml:lang` on the QTI channel, where it currently emits a hardcoded `"en"`.
3. **Chrome locale as composition context.** Publisher, resolution order, change
   signal, graceful default. Add locale to the composition-context table.
4. **Consolidate the i18n layer.** Partly done: `I18nService` is now a
   delegating wrapper over `SimpleI18n` rather than a second copy of it, adding
   only toolkit logging and `initialize()`, and `detectBrowserLocale` has one
   implementation. Both export paths still work, so nothing breaks for a consumer
   that never had one. Outstanding: re-harvest the drifted catalog, and decide
   which of the two entry points survives adoption. Wiring `check-i18n` and
   `scan-hardcoded` into CI waits on adoption — coverage is already 100%, and the
   hardcoded scanner reports 616 findings, so it needs a baseline before it can
   gate anything.
5. **Parameterized PNP and language catalog cards.** `keyword-translation` and
   `glossary-on-screen` as first consumers.
6. **Tool and accommodation locale.** TTS voice selection from the resolved
   language rather than `navigator.language`; STT recognizer language, where the
   STT PRD's proposed `PieDictationInsertDetail.lang` would be the first typed
   runtime locale reaching an element — designed, not implemented; the
   `SIGN_LANGUAGE_NAMES` map.

## Open questions

- Where per-capability tool strings live, given capability neutrality in core and
  `ToolRegistration.name` being host-facing API.
- Whether chrome locale defaults to following content language when a host
  supplies neither, which is what classic PIE effectively does today.
- Whether a whole-body `language-translation` card is a model we want to offer,
  given it asserts item equivalence that a separately calibrated parallel item
  does not.
- Inline English fallbacks versus a single English catalog.
- Unverified in this pass and worth a second research round: Learnosity's locale
  and UI-string-override surfaces, TAO and Cambium/TDS item translation models,
  Smarter Balanced stacked-translation practice, the psychometric comparability
  constraints on treating a translation as the same item, and current
  web-component i18n patterns including `@lit/localize`, ICU MessageFormat and
  `lang`/`dir` inheritance through shadow DOM.
- Whether `item.translation` is populated consistently in Studio production data,
  or whether the `E`/`S` numeric convention is what people actually depend on.
  Determines whether a delivery-side family identifier must be authored
  explicitly rather than derived. Requires a database query; unresolved here.

## References

- [`composition-context.md`](./composition-context.md) — publisher/resolver
  pattern, resolution order, change-signal invariant
- [`../accessibility/accessibility-catalogs-integration-guide.md`](../accessibility/accessibility-catalogs-integration-guide.md)
  — catalog data model, owner scoping, language rungs
- [`../prds/sign-language-asl-support.md`](../prds/sign-language-asl-support.md)
  — `signLang` versus card `language`, grant-and-content availability
- [`../prds/audio-accommodations.md`](../prds/audio-accommodations.md) — the
  POSIX/BCP-47 matching defect
- [`../prds/speech-to-text.md`](../prds/speech-to-text.md) — per-locale
  recognizer provisioning
- [`../tools-and-accomodations/architecture.md`](../tools-and-accomodations/architecture.md)
  — ownership layers, capability neutrality, PNP precedence
- [`../integrations/consumer-api-dependencies.md`](../integrations/consumer-api-dependencies.md)
  — `env` pass-through, attribute typing, propagation risk
- QTI 3.0 implementation guide §2.4.2, §5.2.6, and the APIP migration guide §3,
  §4.1, §4.4 — catalogs, PNP language fields, variants
- AfA PNP 3.0 §4.1.8, §4.1.14, §4.1.17, §4.1.18 — the four language fields
- APIP v1.0 Best Practice guide §2.2.3 and Appendix A — item variants
