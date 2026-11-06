# @pie-players/pie-i18n-generated

## 1.0.0-beta.9

### Patch Changes

- 5eb7c60: Formative delivery is renamed for its mechanism, with no aliases left behind:
  
  - The authored policy is `itemSessionControl` on sections and item refs, typed `ItemSessionControlPolicy`, and the module is `@pie-players/pie-players-shared/item-session-control`.
  - The controller methods are `recordTry`, `retryItem`, `revealItemFeedback`, `hideItemFeedback` and `getTryProjection`, and the events are `item-try-recorded` and `item-feedback-reveal-changed`.
  - The persisted session slice and the composition key are `tries`.
  - The toolkit's internal event is `pie-try-action`.
  - The card's classes are `pie-section-player-check*`, and its data hooks are `data-pie-check-status` and `data-pie-check-action`.
  - The interface messages are `player.check.*`.
  - The timed-media Try budget value `"not-formative"` is `"none"`.
  
  Nothing flags old names. Content authored with `formative` delivers without the check control, and a session saved with a `formative` slice restores with its Try state cleared.
- Updated dependencies [5eb7c60]
  - @pie-players/pie-players-shared@1.0.0-beta.9

## 1.0.0-beta.8

### Patch Changes

- da39465: `en-US` is the only catalog `players-shared` bundles. `BUNDLED_LOCALES` drops `nl-NL`, `BundledLocaleCode` narrows to `en-US`, and `loadBundledCatalog("nl-NL")` rejects — the provider treats that as the fallback chain, so a host whose loaders compose the generated tier resolves Dutch unchanged through the catch, while a host composing only `loadBundledCatalog` that requests `nl-NL` renders English where it rendered Dutch. The Dutch catalog itself — the framework's audit language, native-speaker-reviewed — moves verbatim into `@pie-players/pie-i18n-generated` as a `reviewed` catalog with its English snapshot, so a host that never installs the optional tier never fetches it. The provider unit tests exercise Dutch through a synthesized fixture now, and the item-list tests pin that a bare requested `locale` alone renders English while a composed host serves Dutch.
- 2e692fa: The international deployment set joins the tier: German (`de`, serves `de-AT`/`de-CH`), Italian (`it`), Polish (`pl`, four CLDR plural categories), Turkish (`tr`, serves `tr-CY`), Ukrainian (`uk`, four CLDR plural categories) and Greek (`el`, serves `el-CY`). Each catalog was authored against its own terminology brief with the calibration finding list applied at authoring time — exam-register domain terms (Polish zadanie/tekst, German Aufgabe/Text, Italian brano/prova, Turkish soru/metin, Greek ερώτηση/κείμενο, Ukrainian завдання/текст), impersonal or per-convention register, event-form state announcements, and the Slavic four-category plural systems with correct numeral rules. All six carry agent generation-and-review provenance in the manifest (`reviewedBy`; a native pass remains open work) and English snapshots anchoring them, so regeneration is surgical from here. The tier is now twenty-one reviewed locales.
- d29b05c: The periodic table's phase value (solid, liquid, gas) now shows in the interface locale. A phase the catalog does not carry shows as the data file writes it.
- a9695b7: Toolbar glyphs no longer render blank (R-03, R-13, R-14, R-24). The FontAwesome that `<nds-icon-button>` needs comes from one place, `@pie-players/pie-players-shared/ui/fontawesome`, now used by the item toolbar, the inline TTS control and the section player's scroll hint, which under `ndsIcons` previously had no FontAwesome in its shadow root. The highlighter and strikethrough icon names gain built-in glyphs, and the answer eliminator's button draws its registration's icon. The annotation toolbar's screen-reader announcements follow the interface locale.
- b87143e: The remaining roadmap waves land, fifteen locales in one tier expansion — the tier is now **thirty-six reviewed catalogs**.
  
  **Big US wave**: Russian (`ru`, Slavic one/few/many/other with numeral rules verified against sampled `Intl.PluralRules`), Filipino (`fil`, CLDR `fil` categories verified programmatically; exam register with deliberate homonym rejections — `regla` and `lupa` rejected), Haitian Creole (`ht`, reformed orthography, generic-`ou` impersonal).
  
  **Second RTL wave**: Urdu (`ur`), Persian (`fa`, full ZWNJ orthography), Hebrew (`he`, the wave's only CLDR `two` category, geresh/gershayim conventions pinned). These inherit the audited RTL layout contract — no new layout work.
  
  **Script variant**: `zh-Hant` — Taiwan-register Traditional Chinese authored from `en-US`, deliberately **not** a character conversion of the Simplified catalog, with the term divergences from a naive conversion (軟體/資訊/網路/朗讀…) documented in the brief. Regional tag: bare `zh` stays Simplified; `zh-TW`/`zh-HK` widen onto it.
  
  **State/regional wave**: Somali (`so`), White Hmong (`hmn`, RPA orthography, CLDR-undersourced), Khmer (`km`), Lao (`lo`), Bengali (`bn`), Punjabi (`pa`, Gurmukhi; Shahmukhi documented out of scope), Nepali (`ne`, Devanagari numerals pinned deliberately), Amharic (`am`, Ethiopic punctuation). Each brief carries a **Terminology confidence** section listing judgment calls made without strong evidence, and those README rows state that native review is strongly advised.
  
  All fifteen carry agent generation-and-review provenance in the manifest and English snapshots — regeneration is surgical from here.
- ebd3a05: The RTL layout audit that gated the Arabic locale's review has landed, and `ar` is promoted to `reviewed` on its agent string pass (the audit was the gate). The section player's rtl-layout spec grows from two cases to seven rendered ones against the `ar` demo — formative footer mirror, split-pane order flip, toolbar-pane flip, tool-window contents mirroring with screen-position stability, and a chrome-only clipping/overflow sweep collected through the custom elements' open shadow roots — plus a recorded screenshot inspection of the bidi-sensitive text. The audit found and repairs one defect: the toolbar pane's divider was a physical `border-left`/`border-right`, which under RTL rendered on the pane's outer screen edge instead of the content side; it now uses `border-inline-start`/`border-inline-end`, and the pane-flip assertion pins the geometry. Recorded without assertions: the toolbar scrolls (no overflow menu) and its tooltips are browser `title` rendering; Back/Next chrome belongs to the assessment player; the standalone item player has no locale-driven demo route (a follow-up would close that). With no native readers available, `reviewedBy` in the manifest records the agent provenance; the native pass remains open work.
- fb5c616: Vietnamese (`vi`) joins the generated locale tier as its fourteenth catalog: a bare tag, so `vi-VN` widens to it, generated against a new terminology brief (`briefs/vi.md`) under the same structural gate as the rest of the tier. The Spanish catalog takes a domain-register pass — impersonal `se`-form state announcements (`Se abrió la calculadora básica`), unmarked-masculine enums (`Todos`/`Ninguno`), the `Seleccionar` graph mode, noun phase values (`Gas`), curly quotes over guillemets, singular dictionary misses, and `conjunto de herramientas`/`anfitrión` in place of the `toolkit`/`host` loanwords — with every decision pinned into `briefs/es.md` so a regeneration reproduces it. With no native readers available, the maintainer accepted agent review in their place: `es`, `en-GB` and `en-AU` are now `reviewed` with English snapshots anchoring the passes (`reviewedBy` in the manifest records the agent provenance; the native pass remains open work and corrects in place under the surgical regime). en-GB and en-AU were verification passes: delta sets complete, no missed anglicizations, nothing to correct. The package README gains the RTL layout audit checklist that gates the `ar` review pass, and records that the card-header geometry spec already exists.
- Updated dependencies [551ffeb]
- Updated dependencies [525c81c]
- Updated dependencies [da39465]
- Updated dependencies [e79c775]
- Updated dependencies [ca970e3]
- Updated dependencies [d29b05c]
- Updated dependencies [a9695b7]
- Updated dependencies [dfa89e1]
- Updated dependencies [0e6352f]
  - @pie-players/pie-players-shared@1.0.0-beta.8

## 1.0.0-beta.7

### Patch Changes

- 885b07e: The answer eliminator's `button-alignment` now takes `start`, `end` and `inline`, defaulting to `inline`. `start` and `end` resolve against the choice's direction, and `left` and `right` remain as their aliases. A standalone element that left the attribute unset moves from `right` to `inline`; set `button-alignment="end"` to keep the old placement. The toggle's accessible name and the "(eliminated)" announcement now come from the players' catalog in the interface locale, and carry its `lang` and `dir`.
- Updated dependencies [885b07e]
- Updated dependencies [fedd6a0]
- Updated dependencies [c931537]
- Updated dependencies [8259692]
- Updated dependencies [75f1716]
- Updated dependencies [067cf18]
- Updated dependencies [6da86de]
- Updated dependencies [5c6cbe8]
- Updated dependencies [8bd5891]
- Updated dependencies [584a754]
- Updated dependencies [584a754]
- Updated dependencies [cb55fee]
  - @pie-players/pie-players-shared@1.0.0-beta.7

## 1.0.0-beta.6

### Patch Changes

- @pie-players/pie-players-shared@1.0.0-beta.6

## 1.0.0-beta.5

### Patch Changes

- 2dee856: Adds `<pie-item-list>`: `<pie-item-summary>` rows with a details column, host actions, the item's summary clipped below the first line of each of its `passages`, the entry's search `highlights` below it and a sticky expand button that mounts the item's players. An entry may leave `config` out and carry a `summary`, for a host that fetches the item on `expanded-changed`. A match snippet renders only its text and `<mark>` elements. `details`, `actions` and `highlights` take a custom element tag name, which receives the entry as `entry`, or a render function that may return an `{ update, destroy }` handle or a promise of one; a failing extension fires `extension-error`. `expandedIds` expands rows by id over `expanded`, and the list re-dispatches its rows' `load-complete` and `player-error` with the entry `id` and `part`. One i18n provider serves the list, its rows and their players. `<pie-item-summary>` and the list gain `loaderConfig`, passed to the player. The interface catalogs gain `player.list.expandA11y`, `player.list.collapse`, `player.list.playerError` and `player.list.highlights`, and the theme registers `--pie-item-list-clip-height` and `--pie-item-list-sticky-top`.
- Updated dependencies [e0797ec]
- Updated dependencies [db7d543]
- Updated dependencies [2dee856]
- Updated dependencies [f5e11b1]
  - @pie-players/pie-players-shared@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- 87c6776: Add nine machine-generated locales to the optional tier, chosen against the edtech markets the suite ships into: `en-GB` and `en-AU` (British/Australian English delta catalogs), `es` (Latin-American neutral Spanish), `fr` (France French), `ar` (Modern Standard Arabic — the suite's first RTL locale, whose six CLDR plural categories run the full plural machinery), `pt` (Brazilian Portuguese), `ko` (Korean), `ja` (Japanese) and `zh` (Simplified Chinese). Each ships with a terminology brief, enters as `generated` (unreviewed, freshness-gated), and registers under a tag chosen for variant reach: bare `es`/`fr`/`ar`/`pt`/`ko`/`ja`/`zh` catch every regional host through RFC 4647 widening, while `en-GB`/`en-AU` stay regional so bare `en` keeps resolving to bundled English. Also adds `scripts/validate-catalog.ts`, the self-check a generation run makes before a locale registers. Arabic's layout audit (RTL mirroring, fonts) is still owed before a Middle East host promotes it.
- bd7be0e: The player chrome stamps `lang` and `dir` from the interface locale, so a
  screen reader takes the chrome's language and direction from the locale the
  host set instead of the page's. The stamps sit on each localized element's own
  subtree root — the section shell's host (the light-tree ancestor of every pane,
  card and item player), the toolkit and item-tool-bar hosts and the
  `document.body` tool shells, the section's navigation live region, the session
  debugger and the five shared debug panels, the sign-language region, the inline
  calculator and inline TTS, and the reference assessment player's host. The item
  player's content root asserts neither attribute, so unnamed content keeps the
  browser voice for read-aloud instead of inheriting the chrome's locale. The
  document root is never
  touched. The section's navigation announcement is no longer hardcoded English:
  `player.questionPositionA11y` / `questionPositionLabeledA11y` are new catalog
  keys (the generated `th-TH` catalog carries them). `pie-item-player`'s
  interface messages now re-derive when a lazily loaded catalog becomes
  resident, which previously pinned whatever rendered before the load —
  including its error and loading chrome. `@pie-players/pie-players-shared/i18n`
  exports `stampInterfaceLocale(element, provider)`, the imperative form of the
  `lang`/`dir` pair a template puts on its root, for a host stamping an element of
  its own. Hosts whose content language
  can differ from the interface locale keep naming it in the content markup
  (`lang`/`dir`, or `model.language` on the element); the content-language slice
  stamps the content subtree when the delivery carries a language. No listed host is affected: every surface is a consumer of
  the interface locale, and a host that supplies none renders `en-US` chrome it
  was already rendering.
- 52ade60: Add a Romanian generated locale. Registered under the bare `ro` tag so `ro`,
  `ro-RO` and `ro-MD` all widen to it; standard Romanian as written in Romania,
  with the imperative on controls and `tu` where a possessive is unavoidable,
  comma-below diacritics, Romanian quotation marks, and all three CLDR plural
  forms — `other` takes `de` before the noun (`20 de încercări`), and `102` is
  `few` again. Enters as `generated` (unreviewed, freshness-gated) with a
  terminology brief in `briefs/ro.md`; a Moldovan host overrides per key through
  `customMessages`.
- a3432aa: Corrections to all fourteen interface-locale catalogs from a review by three independent expert reviewers per locale (fidelity and terminology, grammar and linguistics, localization QA); a change landed only where at least two of the three agreed on it. The learner-visible repairs: the Spanish catalog moves its instructions and screen-reader guidance to the unstated-usted register its brief fixes (the catalog had been generated in tú); Korean and Japanese tool-move announcements name the destination coordinate instead of reading it as a distance; the Swedish text-to-speech tool and its announcements are spelled `uppläsning` (the brief carried the same misspelling and is corrected with them); Arabic repairs a garbled debugger label, a reversed developer instruction and two theme strings whose subject bound to the wrong theme; Welsh repairs a garbled protractor description, a missed soft mutation on the four "make taller" controls and the chemistry term for diatomic nonmetals; French names the Spanish dictionaries per its brief and removes a gender-agreement slip; Portuguese gives Previous its own label (it duplicated Back); Romanian announces rotation as `{degrees}°`, the only form grammatical for every value; Chinese pairs rewind with fast-forward (快退/快进) and uses full-width colons in the developer labels; en-GB converts the one `initialize` the delta missed and uses `coordinate grid`, and en-AU takes its own `Graphics Calculator` and `Cartesian plane`, now documented in its brief. The reviewed Dutch catalog takes seven small consistency fixes (`het onderdeel`, `aanbieder`, `Beste beschikbare stem`). Keys, placeholders and plural shapes are unchanged; status stays `generated`, and each manifest entry records the review.
- b6887bb: Add `@pie-players/pie-item-list`: `summarizeItem` (from `./summarize`, Node-safe) reduces a PIE item to a readable summary, and `<pie-item-summary>` renders it as one sanitized list row with math as MathML and answers for instructors only, loading no element code. No summarizer resolver ships yet, so elements summarize from their prompt or label. The row's labels add `player.summary.*` keys to the bundled and generated catalogs.
- 277b122: Add the optional machine-generated locale tier: `@pie-players/pie-i18n-generated` ships provenance-marked, unreviewed catalogs generated from the English source against per-locale terminology briefs, starting with Thai (`th-TH`). Hosts opt in by installing the package and composing its loaders after the bundled ones in `createPieI18n`; a host that never sets a generated locale loads nothing. `check:i18n-generated` gates key, placeholder and plural shape against `en-US` and fails when English has moved and a catalog has not been regenerated. A Dutch calibration run against the audited `nl-NL` catalog (`calibration/nl-NL-calibration.md`) measures what the pipeline delivers and scopes the native review pass.
- 7a68d92: The Thai catalog covers the passage-and-question resize handle and its passage-width readout, which fell back to English.
- a63c2cc: Add Welsh (`cy`) and Swedish (`sv`) generated locale catalogs, alongside UK
  English (`en-GB`) and Arabic (`ar`) already in this package and US English
  (`en-US`), the bundled fallback in `players-shared`. Both new catalogs are
  machine-generated and unreviewed at 517/517 keys against the current English
  source; Welsh carries all six CLDR plural categories on every plural group.
  Hosts opt in by adding `cy`/`sv` to `availableLocales` — nothing loads until a
  host requests them.
- Updated dependencies [6dd6280]
- Updated dependencies [e2f6bde]
- Updated dependencies [3f275b5]
- Updated dependencies [32eab13]
- Updated dependencies [05e4137]
- Updated dependencies [074dfa6]
- Updated dependencies [bd7be0e]
- Updated dependencies [28edb54]
- Updated dependencies [171c84e]
- Updated dependencies [18e07d9]
- Updated dependencies [2f34312]
- Updated dependencies [6d2dcb4]
- Updated dependencies [a3432aa]
- Updated dependencies [b6887bb]
- Updated dependencies [55033fa]
- Updated dependencies [765ddbf]
- Updated dependencies [b1f5a06]
- Updated dependencies [9d1bab9]
  - @pie-players/pie-players-shared@1.0.0-beta.4
