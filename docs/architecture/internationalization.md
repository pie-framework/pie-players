# Internationalization

Status: Active

This note is the design record for language in PIE delivery: interface locale,
content language and in-item language alternates. It is for contributors working
on the players, the assessment toolkit, tools and elements. Interface locale has
shipped: the [interface locale adoption record](./i18n-interface-locale-adoption.md)
holds its decisions and the
[players-shared i18n README](../../packages/players-shared/src/i18n/README.md) its
usage. Read-aloud resolves a content language per read, as
[TTS language](#tts-language) sets out. Content language for the rest of delivery
and in-item language alternates are direction; neither has shipped.

Language is three concerns. Every implementation across the PIE repositories
(pie-players, pie-elements-ng, pie-qti, and the classic pie-elements and pie-lib)
conflates at least two of them, and separating them is most of the design work.
The machinery to serve each concern already exists in one of those repositories.

The three concerns, with the AfA PNP 3.0 field that names each:

| Concern | Whose fact | PNP field | Scope |
|---|---|---|---|
| **Interface locale** | the deployment | `language-of-interface` | player, toolbar, tool UI, `aria-label`s |
| **Content language** | the authored item | — (declared by content) | item body, prompt, choices, passage |
| **In-item alternates** | the learner | `keyword-translation`, `item-translation`, `sign-language` | a word up to the whole item body |

AfA PNP 3.0 defines `language-of-interface` (§4.1.8), `keyword-translation`
(§4.1.14), `item-translation` (§4.1.17) and `sign-language` (§4.1.18) as four
sibling attributes of the `AccessForAllPNP` root, each `[0..1]` and each typed
`LanguageMode`. QTI 3's implementation guide §5.2.6.3 states the independence
directly: a candidate may choose an interface language "which may or may not
also be the language of the content." The split is the standard's.

## Current state

**Interface locale is adopted in pie-players.** A `locale` attribute on the item
player and the section-player layouts publishes a provider on the toolkit runtime
context, and every component that renders a string of its own resolves it from
there. `en-US` and `nl-NL` ship complete, and `check:i18n-coverage` gates the
pre-commit and CI runs. The [adoption record](./i18n-interface-locale-adoption.md)
records the decisions, including why the earlier i18n layer was replaced.

**An optional machine-generated locale tier exists beside the bundled catalogs.**
`@pie-players/pie-i18n-generated` publishes locale catalogs translated by machine
and marked with their provenance. They are unreviewed and freshness-gated, a host
composes their loaders after the bundled ones so reviewed strings always win, and
a locale is promoted into the reviewed set by translation review rather than by
reworking the generated files. `check:i18n-generated` gates the pre-commit and CI
runs; the
[players-shared i18n README](../../packages/players-shared/src/i18n/README.md)
owns the composition pattern.

The hardcoded-string scanner (`scan-hardcoded`) produces a warning report and
never gates. It parses the packages' Svelte templates with the Svelte AST, so
its scope is exactly where rendering is definitional: template text nodes and
static `aria-label`, `title` and `placeholder` attribute values. Strings in
script blocks — where a literal may equally be a diagnostic — are invisible to
it, as is any `{expression}`, so an adopted `t("…")` call site never appears.
It stays advisory on purpose: a finding names a string and a suggested catalog
key, but whether the string reaches a learner is a human call, and a warning
that can fail a build invites suppression. It runs on demand
(`bun run scan-hardcoded`) and weekly via the `i18n-hardcoded-scan` workflow,
which files the report on a tracking issue.

**pie-elements-ng is moving onto a port of this engine, and its chrome is still
keyed on authored content.** `@pie-element/shared-i18n` ports the engine with its
RFC 4647 lookup and per-key fallback to `en-US`, adds `registerMessages` and
`loadLocale` for hosts, and keeps one page registry across every bundled copy.
`@pie-lib/render-ui`, `@pie-lib/correct-answer-toggle` and
`@pie-element/multiple-choice`, which together render multiple-choice's chrome,
carry per-package catalogs on it; IIFE builds ship English only. No interface
locale reaches elements yet, so those three still take theirs from
`model.language`, a model prop the controller copies off the authored item. The
[interface i18n PRD](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/prds/interface-i18n/PRD.md)
plans the rest of the migration.

The other packages localize through i18next. Every `translator.t(` call passes
`{ lng: language }`, the same `model.language`. Catalogs are `en` and `es` only,
both eagerly imported and marked `@auto-generated` from upstream pie-lib, so the
sync overwrites edits and keys cannot be added there. PIE content exists in
languages those two catalogs cannot serve, French and German among them. The
Svelte elements use the same translator where they localize at all. Classic
pie-elements is the same design through `@pie-lib/translator`.

Keying on `model.language` makes interface locale a side effect of content locale:
a Spanish item renders Spanish widget chrome because it is a Spanish item. That is
coherent for wholesale-translated parallel items. It is wrong for an English-chrome
deployment showing a Spanish passage, and for a learner who wants Spanish chrome
over English content.

**Delivery carries three language inputs, and none reaches an element.**

- The players' `locale` attribute sets the interface locale.
- The toolkit's `content-language` input (`RuntimeConfig.contentLanguage`, set
  through the section player's `runtime.contentLanguage`) names the content
  language for read-aloud, and the default the section's players stamp on
  undeclared content ([Content direction](#content-direction)).
- `accessibility.language` on `ToolkitCoordinatorConfig` feeds the catalog
  resolver's default and means content-alternate language.

`Env` (`mode`, `role`, `partialScoring`), `AssessmentSettings`, `ItemSettings`,
`PersonalNeedsProfile` and `ItemSession` carry no language, so an element learns
the content language only from its own authored model.

**The in-item alternate rail already carries language.** `CatalogCard.language` is
QTI's `xml:lang` on the card entry, `AccessibilityCatalogResolver` resolves through
language rungs (exact, then default, then any), and `CatalogStatistics` reports
`availableLanguages`. Sign-language support fixes the mechanics that matter: the
card's `language` is the only field resolution selects on, `signLang` is the
language of the *adaptation* and is never inferred from the item's content
language, and there is no cross-sign-language fallback, by design.

**Language matching follows RFC 4647 lookup.** `AccessibilityCatalogResolver`
normalizes both tags (`_` to `-`, lowercase) and expands the request into its
lookup sequence, so the POSIX `es_ES` that Learnosity imports carry matches an
`es-ES` request. pie-elements-ng's translator carries the same POSIX/BCP-47 split
as a hand-written mapping table, and pie-qti needed the same workaround;
`@pie-element/shared-i18n` normalizes tags the same way this repository does.

**Read-aloud resolves a content language per read**, as
[TTS language](#tts-language) sets out. A read whose markup carries no `lang`, and
whose host sets no `content-language`, falls through the read-locale order there.

**[pie-qti](https://github.com/pie-framework/pie-qti) is the reference for the
split.** Chrome goes through a hand-rolled zero-dependency provider. Content
alternates go through a separate APIP-style catalog subsystem that reads `xml:lang`
(tolerating `xmllang` and `lang`), implements a documented four-step language
fallback including prefix matching, and drives `keyword-translation`,
`glossary-on-screen` and `illustrated-glossary` from the PNP. Its PNP is
**parameterized** (`keywordTranslation?: { active: boolean; languageCode: string }`),
which PIE's flat `PersonalNeedsProfile.supports: string[]` cannot express. Its UI
locale and content language are unconnected on purpose, though it documents that
nowhere.

PIE does not copy three of its choices:

- Locale changes call `window.location.reload()`. That buys real simplicity and
  costs an inline English fallback at every call site, plus a bespoke scanner to
  police their drift.
- The published `dist` retains Vite's `import.meta.glob`, because the build is
  plain `tsc`, so importing the provider throws under webpack, esbuild, Node.js or
  plain browser ESM.
- Pluralization is hardcoded `one`/`other`, so the shipped Arabic catalog's
  `zero`, `two`, `few` and `many` forms are unreachable and Arabic counts render
  the wrong grammatical form.

**Authoring hosts hold the content language and drop it on the way out.** An
authoring host can store a locale on each item and link a translation to its
source item, yet publish neither to delivery:

- Its QTI export declares no content language. The one language value it writes
  is LOM `metametadata/language` in `imsmanifest.xml`, once per package, which
  declares the language of the metadata record, and it emits no `xml:lang`.
- Its PIE export carries locale only in search metadata (`searchMetaData`), which
  no player reads. The **PIE item content JSON carries no locale at all**: the
  search index knows the language, the player never does.

PIE's locale metadata accepts the full CLDR list, `es_419`, `es_MX` and `es_US`
included. An authoring host that supports two languages sets no ceiling for
pie-players: designing for two languages would import a limit only that host has.

## TTS language

`TTSService.speak` resolves the language of each read once, for every entry
point: the inline tool, the annotation toolbar and any host call.

The **content language** is the first of:

1. the nearest `lang` attribute between the content and its player shell; an
   empty `lang`, which the players stamp on undeclared content, ends the climb
   with none;
2. the language the read names, which the inline tool and the annotation
   toolbar take from the toolkit's `content-language` input;
3. `providerOptions.lang_id`, which a host pins for the custom transport.

A host names the language of content whose markup carries none through the
toolkit's `content-language`; a section-player host sets
`runtime.contentLanguage`, which the player passes to its toolkit. The UI
`locale` never sets it.

The **read locale** drives text normalization, sentence segmentation, math
speech and catalog lookups. It is the content language, else the tool config's
`language` (published as `providerOptions.locale`), else
`providerOptions.textNormalization.locale`, else `en-US`. A read with a content
language sets the provider's locales for that read; the next read without one
restores the host's.

Each transport sends the language as follows:

| Transport | Sent | Voice |
| --- | --- | --- |
| Browser | no request | the configured `defaultVoice`, else a voice for the content language, else one for `navigator.language` |
| `pie` (Polly, Google) | `language`: the content language, else the tool config's `language` | the configured `defaultVoice` when one is set; otherwise the server picks one for `language` |
| `custom` (`tts-server-sc`) | `lang_id`: the pinned `lang_id`, else the content language, else the tool config's `language`, else `en-US` | the service's own, from `lang_id` |

A Polly or Google server given no voice keeps its configured default voice when
that voice speaks `language`, and otherwise takes the first voice it lists for
the exact tag, then for the primary subtag (`es` matches `es-US`); Google
prefers a voice of its configured voice type. A server given neither a voice nor
a language reads with its default voice. A named voice always wins, so a host
that names one keeps it whatever language the content is in.

A pinned `lang_id` therefore fixes the custom transport's language for every
read and seeds the content language wherever markup and the tool name none. A
browser fallback drops `lang_id`, along with the rest of the custom transport's
fields.


## Standards

Each claim below is checked against 1EdTech primary sources. Other vendors' models
and the psychometric questions are listed under [Open questions](#open-questions).

**A full translation is a separate item.** APIP v1.0, AfA PNP 3.0 and QTI 3.0 agree:
a wholesale translation is a distinct item file with its own resource identifier
and its own accessibility metadata, never in-item alternate content. APIP BPI
§2.2.3: "Both the English and Spanish versions of the item are known as variants.
Each variant of an item has its own accessibility information coded within its item
XML file." Packaging is a `<variant identifierref="B"/>` inside resource A plus a
sibling resource B. APIP's Appendix A tagging map states that Item Translation (A13)
"Establishes a different variant within the item package", and Keyword Translation
(A14) does not. QTI 3's migration guide carries it forward verbatim.

An authoring host that keeps parallel translated items runs APIP variants without
the manifest: two items with their own identifiers and a link between them. The link
and the language never reach delivery.

**In-item alternates are catalog cards, at any granularity.** The chain is
`qti-catalog-info > qti-catalog > qti-card[support] > qti-card-entry[xml:lang]`,
referenced *outward* from body content by `data-catalog-idref`, the reverse of
APIP's direction. Translation content goes in per-language `qti-card-entry` nodes,
not directly in the card. The implementation guide states that "any element within
the qti-item-body (including the qti-item-body element itself) can point to a
referenced container called a 'catalog'." **The catalog rail can therefore carry a
whole-body translation as well as word-level glosses**, which lets PIE offer more
than one content-localization model within QTI's own vocabulary.

**Language is one accessibility support among peers.** `keyword-translation` sits
in the same enumerated `support` vocabulary as `sign-language`, `spoken`, `braille`
and `linguistic-guidance`, and per-language differentiation uses the same
`qti-card-entry` discriminant for translation (`xml:lang="es"`) and for signed
alternates (`lang="ase"`). QTI 3.0.1 folds APIP's alternate-content mechanism into
core ASI §2.13 alongside SSML and WAI-ARIA instead of keeping it a separate profile.
That is the strongest argument for language riding PIE's existing catalog rail
instead of a subsystem of its own, as pie-qti built.

**Content language is declared with `xml:lang` on `qti-assessment-item`**,
documented as optional but recommended "as the language is a primary accessibility
support". APIP declared it with its own `language` element inside access features;
`xml:lang` appears zero times in its Best Practice guide.

**IMS Content Packaging 1.1.4 declares no language of its own** and delegates to the
separate Meta-Data specification. Package-level language variance rides on LOM
`general/language` or AfA `adaptationStatement/language`, which is where an
authoring host's export declares it.

**Runtime re-resolution against a mutated PNP is proven.** The reference
open-source QTI 3 player applies a language-support change to an already-loaded
item through `setItemContextPnp(pnp)` then `bindCatalog()`, with no XML re-fetch
and no variant swap; `bindCatalog()` takes no arguments and re-resolves DOM catalog
bindings on a mounted item. Rebinding is explicit: mutating the PNP does not trigger
it. The player's default PNP literal shows the type split PIE needs:
`glossaryOnScreen: true` is a boolean toggle, `keywordTranslationLanguage: ''` is a
language code.

**AfA PNP 3.0 is the governing vocabulary.** Where the specs disagree PIE takes the
newer: APIP v1.0 is built on QTI 2.2 bindings and AfA PNP 2.0, QTI 3.0 uses AfA PNP
3.0, and 1EdTech's own document set is inconsistent about versions, casing and
section numbers. PIE codes to `item-translation`, `keyword-translation`,
`language-of-interface` and `sign-language` instead of APIP's
`itemTranslationDisplay` and `keyWordTranslations`, and cites APIP v1.0 only as
evidence for the variant model it originated. The
[tools and accommodations architecture](../tools-and-accomodations/architecture.md)
does the same in framing `requiresAuthoredContent` as AfA's DRD half of the PNP/DRD
pair.

### The chrome engine against web and Unicode standards

The claims above are 1EdTech's and govern content. The interface-locale engine
(`SimpleI18n`, `language-tags`, the generated tier) rests on web and Unicode
standards instead. Each decision below names the authority it complies with; the
divergences after the table are policy choices the standards leave open, recorded
so they read as chosen rather than overlooked.

| Decision | Authority | Where it is met |
| --- | --- | --- |
| Interface locale is a deployment fact the player publishes from `locale` | QTI 3.0 declares item content with `xml:lang` and leaves the delivery's UI language to the platform; LTI passes the platform's display locale as a `launch_presentation` hint; AfA PNP 3.0 `language-of-interface` is a learner preference the platform's policy resolves | one scalar on the composition context ([Interface locale](#interface-locale)); a PNP preference reaches it only through host policy ([tools and accommodations](../tools-and-accomodations/architecture.md)); no element or item sets it |
| Content language is a separate fact, declared on each run | QTI 3.0 `xml:lang`; WCAG 2.2 3.1.2 Language of Parts (AA); HTML `dir` and UAX #9 for direction | `env` carries it ([Content language](#content-language)); `lang` and `dir` go on the content subtree, and on the chrome subtree where the interface locale differs |
| The page owns its language | WCAG 2.2 3.1.1 Language of Page (A) | no player or element writes `document.documentElement` |
| Tags are BCP 47, canonicalized | RFC 5646 (BCP 47); W3C *Language tags in HTML and XML* | `normalizeLanguageTag` and `toLanguageTag`: `es_ES.UTF-8` compares as `es-es` and renders as `es-ES` |
| Lookup, then primary-subtag widening, within the request's script | RFC 4647 §3.4; UTS #35 likely subtags, through ECMA-402 `Intl.Locale.maximize()` | `languageTagLookupSequence` never stops on a singleton; `sv-SE` reaches `sv`, bare `en` the bundled `en-US`; catalog lookup tries the language and likely script before the bare language, so `zh-TW` reaches `zh-Hant`, and a bare-tag catalog declares its likely script, so `zh-TW` passes the Simplified `zh` by and `sr-ME` the Cyrillic `sr`. The accessibility catalog resolver keeps plain truncation |
| Plural forms are CLDR categories | UTS #35 plural rules, through ECMA-402 `Intl.PluralRules` | `other` is required; a catalog carries its locale's set (`cy` and `ar` six, `pt` `one`/`many`/`other`); a category the catalog lacks resolves to `other` |
| Numbers and dates follow the locale | UTS #35 numbering systems and formats, through ECMA-402 `Intl.NumberFormat` and `Intl.DateTimeFormat` | numeric placeholders, `formatNumber` and `formatDate` format at the resolved locale; current CLDR resolves bare `ar` to Western digits and `ar-SA` to Arabic-Indic, so a regional request that widens to the `ar` catalog renders Western digits unless the host registers a regional catalog |
| A control is never unnamed | WCAG 2.2 4.1.2 Name, Role, Value | lookup falls from host messages to the locale's catalog to `en-US` to the key itself; a failed catalog load is reported and renders English |
| Direction comes from locale data | ECMA-402 `Intl.Locale` and the Locale Info proposal's `textInfo`, with an RTL-subtag fallback | `localeDirection` feature-detects `textInfo` and never reads a catalog |
| A learner preference is an accommodation | AfA PNP 3.0; [ADR 0003](../adr/0003-elements-read-accessibility-settings-from-a-host-neutral-context.md) | the profile-to-support mapping lives in the host; an element maps a fixed support id to fixed behavior |

**Deliberate divergences.** Three choices go against a convention or past a
standard, each on purpose.

- *No browser-locale detection.* Consumer web practice honours `navigator.language`
  or `Accept-Language` when nothing else chooses. The engine reads neither, for the
  reasons the [adoption record](./i18n-interface-locale-adoption.md) gives, and
  `detectBrowserLocale()` stays exported for a host that wants it. No standard
  requires detection; the platform-mediated path is LTI's locale hint, which lands
  in `locale` one institutional step away from the device.
- *`en-US` is the default.* No standard names a default. The delivery data and the
  [rollout rule](#rollout), that a rendered string never changes under a host that
  has not opted in, pick it.
- *Structured catalogs rather than Unicode MessageFormat 2.0.* MF2 (LDML 46, 2024)
  is the message-format standard and the catalogs predate it; they stay structured
  on the merits. No engine ships a native runtime, ECMA-402's `Intl.MessageFormat`
  being at stage 1, so MF2 today is a parser in every bundle, which pie-elements-ng
  multiplies per element; the translation tooling that will handle reviewed
  catalogs runs ICU MessageFormat 1; and the engine's semantics already match MF2's
  model, with no key among the 531 using `select`. The standard enters at the
  interchange boundary: catalog-to-ICU MF1, MF2 and XLIFF 2.1 converters,
  gate-validated on import, are the planned tooling. The shape limits nothing a
  locale needs — any tag, any CLDR plural set, any script or direction,
  locale-correct numbers and dates, host overrides, lazy loading — and defers only
  in-message `select` and rich formatting, which no key has needed. If one does, the
  leaf syntax moves behind the same gate; keys, loaders and the fallback chain are
  format-agnostic.

pie-elements-ng adds one of its own, since pie-players has no IIFE build: an IIFE
ships English only and reaches every other locale through `registerMessages`.
Its [interface-i18n PRD](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/prds/interface-i18n/PRD.md)
states the rule as capability tiered by packaging shape, coverage not.

**Where the grounding is thin.** AfA `language-of-interface` is the standards hook
for a PNP-driven interface locale, and no live installation's PNP record carries
one, so the host-policy mapping is designed rather than exercised. The generated
tier is machine output awaiting native review, which its manifests state and its
freshness gate keeps honest. And the gates check parity, not rendered geometry,
which [Pseudo-localization](#pseudo-localization) covers.

### Pseudo-localization

Review catches what a parity gate cannot: clipped labels, strings glued together
in code, text that was never catalog text, and a layout that only breaks when
text grows or runs right to left. Localization toolchains answer that with a
pseudo-locale before any reviewer sees a real string — Windows ships `qps-ploc`
and `qps-plocm`, Android `en-XA` and `ar-XB` — and `pseudoLocalize` in
`players-shared` produces the PIE equivalent from the English catalog at runtime:
every string accented, bracketed and padded roughly 40% longer, with every key,
plural category and `{placeholder}` untouched. It registers through
`customMessages`, so it renders in any build shape; nothing ships it.

`en-XA` exercises expansion and externalization — anything still reading plain
English was never catalog text. `ar-XB` needs no Arabic: its primary subtag
resolves RTL through `localeDirection`, so an English reader watches the chrome
lay out right to left.

```ts
import {
	createPieI18n,
	loadBundledCatalog,
	PSEUDO_LOCALE_EXPANDED,
	PSEUDO_LOCALE_RTL,
	pseudoLocalize,
} from "@pie-players/pie-players-shared/i18n";

export async function pseudoLocalizedProvider() {
	const pseudo = pseudoLocalize(await loadBundledCatalog("en-US"));
	return createPieI18n({
		locale: PSEUDO_LOCALE_EXPANDED,
		customMessages: { [PSEUDO_LOCALE_EXPANDED]: pseudo, [PSEUDO_LOCALE_RTL]: pseudo },
	});
}
```

The demo switcher wires both pseudo-locales through the host-provider seam
([rollout](#rollout) item 7): `apps/section-demos`' `demo-interface-i18n.ts`
composes a provider whose host messages carry the pseudo-localized catalogs and
hands it to the players as `runtime.i18n`, the same way a host hands over a
generated catalog. The section-player interface-locale spec drives `ar-XB`
through the real chrome.

## Direction

### Language resolution at three scopes

One BCP-47 tag-matching function with a documented fallback ladder applies at three
granularities: whole item (form assembly, or variant selection through `env`),
content node (catalog card rungs) and chrome (message catalog lookup). Same
algorithm, same fallback semantics, three scopes. It is the first slice of every
content-localization model, because all of them need it, and three codebases had
hand-written mapping tables in its place.

`@pie-players/pie-players-shared/i18n/language-tags` provides
`normalizeLanguageTag`, `toLanguageTag`, `languageTagsEqual`,
`languageTagLookupSequence`, `findBestLanguageMatch`, `languageTagScript` and `languageTagScriptsMatch`. It replaces exact comparison with RFC 4647 lookup,
normalizes POSIX `es_ES` to `es-ES`, and gives `es-MX` → `es` → default a defined
answer. The catalog resolver expands each requested tag into its lookup sequence,
and `getAllAlternatives` keys on the normalized tag, so two spellings of one
language collapse into the one alternate that resolution returns.

The module is a pure function with no DOM and no locale data, kept out of `./i18n`
so importing it does not pull the eagerly bundled English catalog. That keeps it
Node-safe, inside the `nodeSafe` publish constraint, and usable by the catalog
resolver, the TTS voice selector and the chrome layer alike.

### Interface locale

The deployment picks the interface language, and no element or item can know it,
so interface locale is a [composition context](./composition-context.md) with a row
in that note's table. The player publishes one scalar from its `locale` attribute,
`resolveInterfaceI18n` is the only resolver, the context republish is the change
signal, and with no publisher the locale is `en-US`. It does not follow content
language, which is what classic PIE effectively does. The
[adoption record](./i18n-interface-locale-adoption.md) holds the decisions and the
[players-shared i18n README](../../packages/players-shared/src/i18n/README.md) the
usage.

Interface locale stays out of `model`. The four arguments in
`composition-context.md` apply verbatim: the publisher does not know its consumers,
the consumer set is open, resolvers must work with no container, and the value
changes after mount. Classic PIE keys chrome on `model.language`, which is why its
interface locale is a side effect of content locale.

PIE elements read the same fact on a second, host-neutral channel:
`interfaceLocaleContext` in `@pie-players/pie-context`, keyed
`Symbol.for("pie.interfaceLocale")`, which the toolkit and the item player
answer with `{ locale, direction }` — the tag as the player's provider resolved
it and its writing direction — and republish on a locale change and again once
a lazily loaded catalog is resident. Element bundles are third-party and
release independently, so they get the key and the value shape rather than the
players' provider, resolve the tag against their own catalogs, and treat an
unanswered request as `en-US`. The value only grows, per ADR 0003's protocol.
pie-elements-ng's
[interface-i18n PRD](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/prds/interface-i18n/PRD.md)
is the subscriber half: an element subscribes in `connectedCallback`, re-renders
on republish, and passes the locale to the `language` prop its libraries take.

### Content language

Content language in `env` for elements is direction and has not shipped. The
shipped path, the toolkit's `content-language` or the section player's
`runtime.contentLanguage`, serves read-aloud and the players'
[content direction](#content-direction) default.

The design carries content language to elements in `env`, for the same reason `env`
carries `mode`: both are delivery facts that legitimately filter authored content,
and `mode` already drives controllers to filter correct answers out of the model.
Selecting which language variant of authored content to return is the same
operation. Interface locale takes a different channel because it is a fact about
the container that content cannot know; content language is an input to a filter
over authored data.

A typed `locale` on `Env` is safe. The
[consumer API dependencies](../integrations/consumer-api-dependencies.md) record
makes `env` pass-through load-bearing and forbids filtering it, so an untyped key
already survives the pipeline. A new custom-element attribute must be
`type: "String"`, because hosts pass `show-toolbar` as both the literal `"false"`
and boolean `true`, and both must keep working.

#### Content direction

The item player stamps `lang` and `dir` on its content root from the nearest
declared content language, so the interface locale's `lang` and `dir` on the
chrome never claim the content. The resolution order:

1. the element's `model.language`, which the element stamps on its own host;
2. a `lang` in the content's markup;
3. the item's `env.locale`;
4. the player's `content-language`, which a section sets from
   `runtime.contentLanguage`;
5. with an interface `locale` set and nothing above, `lang=""` with
   `dir="auto"`: the language unknown, the direction from the content's first
   strong character.

Steps 4 and 5 apply only when the host sets `locale` or names a content
language, so a host that sets neither leaves undeclared content inheriting the
page's language and direction, as before. The players' `contentLanguageDefault`
on the toolkit context carries the section's step 4–5 default to the item and
passage players a section mounts, which carry no `locale` of their own.

A default that names a direction — step 4 — is a guess about content that
declared nothing. When the content's first strong character contradicts it, the
item player logs one `console.warn` per player, in every build: a library build
cannot tell a development page from a production one.

`dir="auto"` reads light-DOM text only: a browser skips text inside a shadow
root when it picks the direction. pie-elements-ng elements render in light DOM;
an element that renders its text in a shadow root declares its direction.

For content, only pie-elements-ng's `multiple-choice` writes `dir` on its own
host.

Six elements write `lang` onto their own host: `explicit-constructed-response`,
`extended-text-entry`, `inline-dropdown`, `math-inline`, `multiple-choice` and
`passage`, the same six in pie-elements-ng and in classic pie-elements. Each
computes `language ? language.slice(0, 2) : 'en'` off `model.language`, so an absent
model language stamps `lang="en"` instead of leaving the attribute off. The
exception is pie-elements-ng's `multiple-choice`, which stamps the canonical tag of a
declared language and leaves `lang` and `dir` off otherwise. Outside those six
elements `:lang()` and hyphenation have nothing to key on, and inside them they key
on a language the content may not be in. The same holds for screen-reader
pronunciation and every other consumer of the attribute.

That default constrains the slice. `lang` inherits and the nearest ancestor wins, so
inside those six subtrees the element overrides a content wrapper carrying the
resolved language. Imported content often stores no `language` in its element
models, which is precisely the case that triggers it. Reflecting on the wrapper is
necessary and insufficient: either the element default becomes "stamp `lang` only
when `model.language` is present", or `env.locale` reaches `model.language` at the
controller boundary. `passage` is the sharpest case: an English-chrome deployment
showing a Spanish passage asserts `lang="en"` over Spanish prose.

With the element default handled, this is the highest-leverage slice per unit of
effort in this note, and it is blocked only on the item payload carrying a
language.

### In-item alternates and parameterized PNP

Language alternates are catalog cards. `keyword-translation`, `glossary-on-screen`
and `language-translation` are QTI's own `support` names, so adding them is
spec-aligned, and `CatalogType` is open by design. The resolver, the rungs, owner
scoping and `data-catalog-idref` docking exist, and the toolkit's tool-surface host
already hands every content capability the owner-scoped catalog snapshot
([Owner-Scope Resolution](../prds/audio-accommodations.md#owner-scope-resolution)
in the audio accommodations PRD).

The learner's profile has no way to say *which* language.
`PersonalNeedsProfile.supports: string[]` cannot carry a parameter, while AfA types
all four language fields as `LanguageMode`, and APIP made `language` mandatory at
multiplicity [1] on both `itemTranslationDisplay` and `keyWordTranslations`.
Parameterizing PNP supports is the enabling change for this layer. It changes a
public type under lockstep versioning, so it is one change to `supports`; a second
field beside it is the alternative it avoids.

Re-resolution against a mutated profile is explicit, following the reference
player, which also satisfies the change-signal invariant in
`composition-context.md`.

### Content-localization models

Host content teams produce parallel translated items, and QTI models wholesale
translation the same way. That is current practice and a standards alignment, and
the framework does not impose it. Four models fit, and three of them need no new
data model.

**Parallel items with a family link.** Today's practice. Each variant is separately
calibrated and selected at form assembly, with no runtime swap. It needs the
content-language declaration on the payload and a family identifier that survives
export. An authoring host's translation link reaches delivery, if at all, on a
channel the player does not read.

The family link is derivable from authoring data, within limits. Where the link
sits only on the translated item and names the source item's internal identifier,
the source-to-translation direction is built by inversion, and a translated item
with no link has nothing to invert. A public-ID numbering convention is no
substitute: it is unvalidated, and an item can exist with no counterpart, so the
numbering carries no pairing that can be computed.

**Whole-body catalog alternate.** A single `language-translation` card docked at
the item-body level, resolved at runtime against the learner's profile. QTI permits
exactly this, PIE's resolver already implements the selection, and the reference
player proves runtime rebinding without a re-fetch. One item id and one calibration
record, which is a psychometric claim of equivalence that someone has to make.

**Per-node alternates.** `keyword-translation` and glossaries: partial translation,
learner-toggled and PNP-gated. The existing rail covers it once PNP is
parameterized.

**Stacked or side-by-side dual language.** A presentation mode over any of the
first three, with no data model of its own. It needs a region and an arbitration
rule.

The second model exceeds what authoring hosts emit and what the QTI export
round-trips, so its cost is interop work rather than player work.

## Packaging

PIE ships a single English catalog with a provider that always exists, and no
inline English fallbacks. pie-qti takes the opposite trade: every import of its
i18n package is `import type`, erased at compile time, and components declare an
optional provider and fall back to an inline English literal, so a host that never
constructs a provider ships no i18n runtime and no locale bundles. Total erasure
costs an inline fallback at every call site and a scanner to keep them from
drifting.

Catalogs are TypeScript modules under `packages/players-shared/src/i18n/messages/`.
`players-shared` is built by plain `tsc` and cannot emit chunks: `tsc` passes a
dynamic `import()` through for the consumer to bundle or serve, so the package
cannot split or fingerprint locale assets itself.

The item player and the section player's browser build set `external: []`, and the
print player declares no externals, so each inlines a locale bundle imported from
`players-shared` unless it is made external or fetched at runtime.

Tool display names ride on `ToolRegistration.nameKey` and `descriptionKey`, which
`default-tool-loaders` supplies. Core stays capability-neutral, as
`check:capability-neutrality` enforces, and `name` and `description` stay the
host-facing fallback strings. `hooks.cardTitleFormatter` is the precedent for a
host-owned string override.

## Rollout

pie-players versions its packages in lockstep, patch only, and hosts take them on
caret ranges or exact pins; the
[consumer API dependencies](../integrations/consumer-api-dependencies.md) record
lists each host's. A change that alters a rendered string reaches a caret-range
host on its next install, with no build signal on its side, so every slice is
behavior-preserving until a host opts in by supplying a locale.

1. **BCP-47 resolution.** Done; see
   [Language resolution at three scopes](#language-resolution-at-three-scopes).
2. **Content language end to end.** In part landed. The player half:
   `Env.locale` is typed and the item player reflects it as `lang`/`dir` on the
   content subtree; undeclared content takes the
   [Content direction](#content-direction) default. The element half:
   all six elements that stamped `lang` off `model.language` now stamp a
   canonical declared language with its direction and nothing otherwise — the
   `'en'` default is gone. Still open: authoring hosts emitting locale on the
   PIE content channel and `xml:lang` on the QTI channel; the
   [Current state](#current-state) records what they emit today.
3. **Interface locale as composition context.** Done; see
   [Interface locale](#interface-locale).
4. **Consolidate the i18n layer.** Done. `SimpleI18n` is the only implementation,
   the catalog is harvested from call sites, and `check:i18n-coverage` runs in the
   pre-commit and CI gates. `scan-hardcoded` is advisory and stays so: it reads
   the Svelte AST, so it warns only on template text and static
   `aria-label`/`title`/`placeholder` literals — a scoped weekly report, not a
   gate.
5. **Parameterized PNP and language catalog cards.** Not started.
   `keyword-translation` and `glossary-on-screen` are the first consumers.
6. **Tool and accommodation locale.** In part done.
   - Done: read-aloud's content language, whose contract is
     [TTS language](#tts-language); browser TTS picks its voice from it before
     `navigator.language`. The sign-language region's accessible label names the
     signed language through catalog keys (`SIGN_LANGUAGE_NAME_KEYS`), so it
     follows the interface locale.
   - Open: a data decision alongside the tag decision. Content written for US
     Spanish speakers can be stored as `es_ES`, and normalizing that to `es-ES`
     preserves the wrong region faithfully enough to select a Castilian voice.
   - Open: STT recognizer language. The [speech-to-text PRD](../prds/speech-to-text.md)
     proposes `PieDictationInsertDetail.lang`, which would be the first typed
     runtime locale reaching an element; it is designed, not implemented.
7. **Host-supplied messages and locales.** Done; see the
   [host-supplied interface locale provider PRD](../prds/interface-i18n-host-provider.md).
   `runtime.i18n` on the section-player layouts and an `i18n` property on the
   toolkit and the item player accept the
   [`I18nProvider`](../../packages/players-shared/src/i18n/README.md#for-a-host)
   a host composes — the generated tier's catalogs, `customMessages`, or a
   provider of the host's own. The `locale` attribute still names the locale,
   and a supplied provider is driven only by it. A section forwards its
   provider to the item players it mounts, so their own chrome follows the
   section's locale instead of the third English provider it built before.

## Open questions

- Whether PIE offers a whole-body `language-translation` card as a model, given it
  asserts item equivalence that a separately calibrated parallel item does not.
- A second research round on Learnosity's locale and UI-string-override surfaces,
  TAO and Cambium/TDS item translation models, Smarter Balanced
  stacked-translation practice, the psychometric comparability constraints on
  treating a translation as the same item, and web-component i18n patterns
  including `@lit/localize` and `lang`/`dir` inheritance through shadow DOM. The
  message-format question is settled under
  [The chrome engine against web and Unicode standards](#the-chrome-engine-against-web-and-unicode-standards).

## References

- [`i18n-interface-locale-adoption.md`](./i18n-interface-locale-adoption.md) — the
  shipped interface-locale decisions
- [`../../packages/players-shared/src/i18n/README.md`](../../packages/players-shared/src/i18n/README.md)
  — provider, catalogs and adoption pattern
- [`../../packages/pie-i18n-generated/README.md`](../../packages/pie-i18n-generated/README.md)
  — the optional machine-generated locale tier
- [`composition-context.md`](./composition-context.md) — publisher/resolver
  pattern, resolution order, change-signal invariant
- [`../accessibility/accessibility-catalogs-integration-guide.md`](../accessibility/accessibility-catalogs-integration-guide.md)
  — catalog data model, owner scoping, language rungs
- [`../prds/sign-language-asl-support.md`](../prds/sign-language-asl-support.md)
  — `signLang` versus card `language`, grant-and-content availability
- [`../prds/audio-accommodations.md`](../prds/audio-accommodations.md) — the
  POSIX/BCP-47 matching defect, owner-scope resolution
- [`../prds/speech-to-text.md`](../prds/speech-to-text.md) — per-locale
  recognizer provisioning
- [`../tools-and-accomodations/architecture.md`](../tools-and-accomodations/architecture.md)
  — ownership layers, capability neutrality, PNP precedence
- [`../integrations/consumer-api-dependencies.md`](../integrations/consumer-api-dependencies.md)
  — `env` pass-through, attribute typing, propagation risk
- [pie-qti](https://github.com/pie-framework/pie-qti) and
  [pie-elements-ng](https://github.com/pie-framework/pie-elements-ng) — the
  i18n designs surveyed under [Current state](#current-state)
- QTI 3.0 implementation guide §2.4.2, §5.2.6, and the APIP migration guide §3,
  §4.1, §4.4 — catalogs, PNP language fields, variants
- AfA PNP 3.0 §4.1.8, §4.1.14, §4.1.17, §4.1.18 — the four language fields
- APIP v1.0 Best Practice guide §2.2.3 and Appendix A — item variants
- WCAG 2.2 success criteria 3.1.1, 3.1.2 and 4.1.2 — language of page and of
  parts, accessible names
- RFC 5646 (BCP 47) and RFC 4647 §3.4 — language tags and lookup; W3C
  *Language tags in HTML and XML* — canonical form
- UTS #35 (LDML) — plural rules, numbering systems, and Unicode MessageFormat
  2.0 (LDML 46)
- ECMA-402 — `Intl.PluralRules`, `Intl.NumberFormat`, `Intl.DateTimeFormat`,
  `Intl.Locale`; the Intl Locale Info proposal — `textInfo`
- LTI 1.1 `launch_presentation_locale` and the LTI 1.3 `launch_presentation`
  claim — the platform's display-locale hint
