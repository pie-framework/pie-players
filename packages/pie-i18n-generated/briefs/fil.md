# Filipino (fil) brief

Serves every Filipino host: the catalog is registered under the bare `fil`
tag, so `fil`, `fil-PH` and `fil-PH`'s uncanonicalized spellings widen to it.

**The `tl` alias.** `tl` (Tagalog) is registered as an alias entry in the
loader map and manifest that loads this same catalog
(`tl: () => import("./messages/fil.js")`, `src/messages/tl.ts` re-exports
`fil`): US assessment systems (and US federal/state label sets) name the
language Tagalog, while modern stacks and CLDR name it Filipino, and a host
requesting `tl` would otherwise widen to nothing — `tl` and `fil` are
different primary subtags, so no lookup chain connects them. One authored
catalog, two tags. There is no separate `tl` brief or `tl` catalog; the
manifest's `tl` entry points at this brief.

Content flavour is **modern Filipino** — Tagalog-based, the register of
DepEd materials and Filipino-language software (Facebook Filipino, Google
Filipino) — written for learners, teachers and proctors. Where the domains
have no Filipino word (graphing, assessment-delivery chrome), the modern
Filipino answer is the naturalized loan, not a coined term.

## Register

Per string class:

- **Controls carry the context-marked verb**: `Isara`, `I-save`, `Suriin ang
  sagot`, `Ipasa`. Filipino verbs mark focus and aspect, not person, so a
  control needs no pronoun and no politeness particle — there is no
  po/opo in software.
- **Sentences prefer verb-first impersonal phrasing**: `Hindi na-load ang
  pagsusulit.`, `Hindi naibalik ang mga naka-save na sagot sa bahaging
  ito.` The generic actor is dropped; where a possessive is unavoidable the
  actor-less `naka-save na sagot` framing replaces `mga sagot mo`.
- **State changes are announced as perfective events** (`-in-`/`na-`/
  `i-`-infixed verbs, never statives): `Binuksan ang payak na kalkuladora`,
  `Isinara ang graping kalkuladora`, `Inilipat pataas sa {position}`,
  `Napalitan ng {unit}`, `Naitala ang sagot.` Filipino perfective aspect
  marks the completed event without gendering anything — the analogue of
  the Polish `-no/-to` rule, at zero morphological cost.
- **Loan verbs take the Filipino affix, hyphenated** — the modern-Filipino
  orthographic convention: `i-save`, `i-drag`, `na-load`, `na-pause`,
  `naka-enable`, `mag-interact`, `i-zoom`, `ni-rotate`. Spelling them as one
  word (`isave`, `naload`) or coining native equivalents is rejected.
- **Loading states take the progressive label**: `Naglo-load…`,
  `Naglo-load ang kalkuladora…`.
- **Outcome announcements are adjectival**: `Tama.`, `Bahagyang tama.`,
  `Hindi tama.`
- `pero` (not `ngunit`) in full sentences — modern register; `po`/`opo`
  politeness particles stay out entirely.
- Whole sentences are authored whole; no fragment assembly.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any single
string's fidelity.

| English | Filipino | Note |
| --- | --- | --- |
| question / items | tanong / mga tanong | the learner-facing unit; `aytem` stays out of learner chrome (kept Latin in the debug panel only) |
| passage | akda | the school-literature word for a reading selection (`Basahin ang akda`); `teksto` is the alternative, rejected for the learner-facing label |
| section | bahagi | DepEd exams number Bahagi I, II…; `seksyon` is the administrative calque |
| assessment | pagsusulit | the school test word; `eksamen`/`pagtatasa` rejected |
| submit | Ipasa | hand-in register; `Isumite` rejected as untranslated |
| finish | Tapusin | |
| check answer | Suriin ang sagot | check = `suriin` |
| try (noun) | pagsubok | `May {count} pagsubok na natitira.` |
| answer (learner's) | sagot | correct answer = `tamang sagot` |
| settings | Mga Setting | the loan Facebook/Google Filipino shows |
| tool(s) / toolbar | kagamitan / toolbar | tools = `mga kagamitan` (assessment tools = `mga kagamitan sa pagsusulit`); toolbar stays the loan |
| panel / resize | panel / baguhin ang laki | "change the size" framing |
| loading… | Naglo-load… | |
| teacher | guro | the Filipino school word over `titser` |
| content | nilalaman | the Filipino word, over `content` |
| word / phrase / sentence | salita / parirala / pangungusap | |
| word count unit: entry (dictionary) | tala | the record/entry word; `No entry` = `Walang tala…`; rejected `entrada` (Spanish-era register) |
| picture | larawan | picture dictionary = `Diksiyonaryo ng Larawan` |
| calculator | kalkuladora | naturalized Spanish loan; basic = `Payak na Kalkuladora` (payak = simple/basic), scientific = `Siyentipikong Kalkuladora` (KWF spelling si-), graphing = `Graping Kalkuladora` (the loan-gerund Filipino math materials keep) |
| graph | Grap | `graf` would lose the English-shape recognition math materials keep |
| coordinate plane | plano ng mga coordinate | Spanish loan `plano` (plane) + the loan `coordinate`, the mixed register Filipino math classes actually speak; a coined KWF term would be unrecognized |
| grid | grid | loan; opacity = `opacity` (loan; no naturalized Filipino word exists) |
| point | punto | the math word (Spanish loan); watch the homograph `puntos` (score) — only `punto` is used |
| line (drawing mode) | Linya | the school word; the two-endpoint construction lives in the hint, not the mode name |
| selector mode | Piliin | action-name modes: Punto, Linya, Piliin, Tanggalin |
| delete (graph) | Tanggalin | remove-an-object register |
| periodic table | Periyodikong Talaan | the Filipino chemistry term (`talaan` = table/list) |
| element | elemento | |
| atomic number / atomic mass | atomikong bilang / atomikong masa | `bilang` is the Filipino word for number; both spelled out for screen readers |
| electron configuration | kaayusan ng elektron | "arrangement of electrons" — transparent Filipino; `elektron` per KWF spelling |
| phase (solid/liquid/gas) | anyo | "form/state"; values Solido / Likido / Gas — consistent loan spellings |
| filter | salain | the Filipino word (to sift); the filtered result = `salaan`; the debug panel keeps the `filter` loan |
| element categories | Metal na Alkali, Metal na Alkaline Earth, Metal na Transition, Metal na Post-Transition, Metaloyd, Diatomikong Di-metal, Polyatomikong Di-metal, Marangal na Gas, Lantanido, Aktinido | the "X na Metal" descriptive pattern Filipino textbooks use; `Marangal na Gas` is the established Filipino Wikipedia rendering of noble gas |
| ruler | Ruler | **kept English** — the classroom word in the Philippines; `regla` rejected: in everyday Filipino it means menstruation |
| inches / centimeters | pulgada / sentimetro | both fully naturalized Spanish loans; sentence forms identical |
| protractor | Protractor | kept English like Ruler; no naturalized Filipino word exists |
| degrees | degrees | loan, kept in rotate/announce strings; the `°` glyph stays |
| clockwise / counterclockwise | clockwise / counterclockwise | kept English — the directional loans Filipino school math uses; the native `pakaliwa/pakanan` pair risks left/right confusion in rotation contexts |
| dictionary | Diksiyonaryo | the widely recognized naturalized loan; `talahulugan` (the KWF term) noted as the formal alternative |
| Spanish (language name) | Espanyol | KWF spelling; `Diksiyonaryong Espanyol` |
| line reader | Gabay sa Pagbasa | the reading-guide tool; reading window = `bintana ng pagbasa`, frame = `balangkas`, overlay verb = `tumatablip` |
| magnifier | Magnifier | kept English like Ruler/Protractor; `lupa` is farmland in Filipino — banned homonym |
| zoom in / zoom out | Palakihin / Paliitin | enlarge/reduce — clean Filipino; zoom level stays `{zoom}×` |
| highlight(er) | I-highlight / Highlighter | the loan verbs Filipino software uses; color values keep the Filipino color words: `Dilaw/Rosas/Asul/Berde na highlight` |
| underline | Salungguhitan | the DepEd school word (`salungguhitan ang paksa`), over the loan |
| annotate / annotation | Mag-annotate / Anotasyon | loans |
| strike through | i-cross out | the action loan Filipino documents use; tool name `Pag-cross Out ng Sagot`; eliminated choice appends `(na-cross out)`; rejected `tigpas`, `barahin` |
| choice (answer option) | pagpipilian | |
| remove / clear all | Alisin / Burahin Lahat | three distinct Filipino removal verbs pinned: `tanggalin` (remove an object), `alisin` (remove from a place), `burahin` (erase/wipe) |
| theme | Tema | the naturalized loan; never `paksa` |
| read aloud | basahin nang malakas | adverbial `nang` (not `ng`); tool name = `Pagbasa nang Malakas` |
| playback speed | bilis ng pagbasa | |
| rewind / fast-forward | i-rewind / i-fast forward | loan verbs; announcements `Na-rewind`, `Na-fast forward`, failures `Hindi ma-rewind` |
| voice (TTS) | boses | naturalized from Spanish voz |
| gender | kasarian | values Lalaki / Babae / Neutral — the natural Filipino gender words |
| engine (TTS) | Engine | tech value kept; `Neural`/`Standard` values likewise |
| sample (TTS text) | halimbawa | `Halimbawang teksto` |
| speech marks | speech marks | dev-panel term kept |
| recommendation | irekomenda | `Inirerekomendang mga boses` |
| sign language | wikang senyas | generic lowercase mid-sentence; named languages translated as `Wikang Senyas ng {bansa}` (Amerika, Britanya, Pransya, Gresya, Mehiko); Signed English = `Senyas na Ingles` |
| audio transcript | transkrip | `Transkrip ng Audio` |
| summary (item list) | buod | `Ipakita ang buod`; also the PNP provenance summary |
| match (search) | tugma | `Mga tugma sa paghahanap`, matching voices = `katugmang boses` |
| example | halimbawa | |
| reference | sanggunian | the school word (`sanggunian sa kimika`) |
| district (PNP) | distrito | naturalized loan |
| accommodation (PNP) | akomodasyon | DepEd inclusion-policy spelling |
| policy | patakaran | |
| placement | placement | dev-panel loan, like provider/coordinator/toolkit |
| resolved | naresolba | `Mga Kagamitang Naresolba` — naturalized from `resolba` |
| session / record | sesyon / record | dev panels; the dictionary entry stays `tala`, instrumentation records stay `record` |
| item (debug only) | item | kept Latin in developer panels, exactly like the `host` precedent in the vi/pl briefs |
| n/a | n/a | kept |
| enabled / disabled / off / on | Naka-enable / Naka-disable / Naka-off / Naka-on | the `naka-` state prefix is the modern-Filipino toggle register, used as `{state}` values in `headerRowReservation` |

## Grammar and agreement pins

- Filipino has **no numeral agreement**: nouns do not inflect after
  numbers, and the plural marker `mga` is wrong after a numeral
  (`tatlong boses`, never `tatlong mga boses`). Consequences, pinned:
  - The plural groups' two categories carry **identical text** — the CLDR
    one/other split is carried because `Intl.PluralRules("fil")` selects
    it, not because the strings differ.
  - `{pixels} pixel` and `{width} × {height} pixel` are safe inline — no
    agreement evasion is needed.
  - Standalone region and label plurals take `mga` (`Mga Akda`, `Mga
    Tanong`, `Mga kagamitan`), and the `mga` phrase stays lowercase
    mid-sentence (`mga kagamitan sa pagsusulit`).
- Sentence-internal field labels stay lowercase: `{name}, simbolo:
  {symbol}, atomikong bilang: {number}, atomikong masa: {mass}, kategorya:
  {category}`. Enum values stay capitalized as list entries.
- Proper names (Wikang Senyas ng Amerika, Diksiyonaryong Espanyol) keep
  capitals in every position; common nouns after `{label},` stay lowercase.
- Sizes join with the multiplication sign: `{width} × {height}`.
- `Graph point {id}` renders without the tool name: `Punto {id}`, following
  the audited Dutch de-duplication.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, **Hz** (Latin symbol kept in
the sample-rate values); code identifiers in the PNP prose (`assessment`,
`updateAssessment(...)`, `requiredTools`, `toolkit`, `provider`,
`coordinator`, `profile`, `district`→`distrito` translated); instrumentation
record kinds and session-db field names
(`all`/`event`/`error`/`metric`/`user-context`/`global-attributes`,
`assessmentId:`, `sectionId:`, `attemptId:`, `mode:`); the SSML tag named in
prose (`emphasis`); the `/api/tts` and `en-US` placeholders; TTS-format and
engine values (`MP3`, `OGG`, `PCM`, `WaveNet`, `Studio`, `Neural`,
`Standard`, `Engine`).

## Plurals — the CLDR fil categories

`Intl.PluralRules("fil")` resolves exactly two categories, verified
programmatically against sampled counts:

- **one** — 0, 1, 2, 3, 5, 7, 8, 10, 11, 12, 13, 15, 20, 21, 30, 40, 100,
  101, 1000000, and decimals ending in a non-4/6/9 digit (1.5, 4.5, 0.5).
- **other** — integers and decimals whose final digit is 4, 6 or 9:
  4, 6, 9, 14, 16, 19, 24, 34, 44, 104, 114, 1004, 0.4, 1.4, 5.4, 14.4.

Filipino nouns do not inflect after numerals, so each group carries
`one`/`other` with `{count}` and identical text:

- `player.formative.triesLeft`: `May {count} pagsubok na natitira.` (both)
- `tools.dictionary.entriesCount`: `{count} tala` (both)
- `tools.pictureDictionary.entriesCount`: `{count} larawan` (both)
- `debug.tts.browserAvailable`: `Available ang TTS ng browser (na-detect na
  {count} boses).` (both)
- `debug.tts.pollyAvailable`: `Available ang AWS Polly ({count} katugmang
  boses, {engine} engine).` (both)
- `debug.tts.googleAvailable`: `Available ang Google Cloud TTS ({count}
  katugmang boses).` (both)

Arabic numerals everywhere; `{count}`, `{position}`, `{percent}` render as
digits. Filipino is LTR; nothing here overrides direction.

## A11y strings

Keys ending `A11y` are complete, self-sufficient screen-reader sentences —
the learner hears them without seeing the layout — and every keyboard
instruction stays concrete. Latin key names stay Latin, as Filipino
keyboards print them: Shift, PageUp, PageDown, Escape, +/-, U. Ruler units
are spelled out (`pulgada`, `sentimetro`) because a screen reader says `cm`
as two letters.
