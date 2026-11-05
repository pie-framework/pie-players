# Haitian Creole (ht) brief

Serves every Haitian Creole host: the catalog is registered under the bare
`ht` tag, so `ht` and `ht-HT` widen to it. Content flavour is Haitian
Kreyòl in the **reformed (1975/1987) orthography** — the standardized
spelling Haitian schools teach and Haiti's official documents use — with
education terminology as Haitian schools and assessment programs
(Emplois de Temps, MENFP exam papers, Haitian edtech) actually present it.

## Register

Per string class:

- **Controls carry the bare verb** — the default register of Haitian
  software strings, which have no infinitive to hide behind: `Fèmen`,
  `Sove`, `Tcheke repons lan`, `Soumèt`. Creole verbs mark no person, so a
  control needs no pronoun and no politeness particle.
- **Sentences take verb-first phrasing with the definite article
  postposed** — the Creole grammar the catalog leans on throughout:
  `Kontni seksyon an pa t ka chaje.`, `Egzamen an pa t ka chaje. Eseye
  ankò.`
- **Generic `ou` is the Creole impersonal.** Where English uses a passive
  and the grammar wants a subject, the catalog uses generic `ou` — the
  language's own neutral-address convention (`anvan ou kontinye ak medya
  a`). This is the Creole analogue of the nl-NL calibration's finding that
  a global pronoun ban produces stiffer prose: in Creole, `ou` in a
  capability or instruction sentence is impersonal register, not direct
  address.
- **State changes are announced as `te`-marked events**, the perfective
  past marker: `Te louvri kalkilatris debaz la`, `Te fèmen kalkilatris
  syantifik la`, `Te deplase anwo nan {position}`, `Te vire nan {degrees}
  degre`, `Te chanje an {unit}`, `Te agandi nan {zoom} fwa`. Creole has no
  participles, so the "events, never gendered stative participles" rule
  costs nothing — `te` + verb is the only event form, and it never genders
  the tool.
- **Capability phrases take `ki ka`** (that can): `Zouti mezi règ ki ka
  deplace e vire` — attributive, no participle possible.
- **Failure sentences take `pa t ka` + verb** (could-not, event past):
  `pa t ka chaje`, `pa t ka demare`, `pa t ka tcheke`, `pa t ka retabli`.
- **Loading states take the progressive `ap` + verb**: `Ap chaje…`, `Ap
  chaje kalkilatris la…`.
- **Outcome announcements are adjectival**: `Kòrèk.`, `Pasyèlman kòrèk.`,
  `Pa kòrèk.`
- Whole sentences are authored whole; no fragment assembly.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any single
string's fidelity.

| English | Haitian Creole | Note |
| --- | --- | --- |
| question / items | kesyon / kesyon yo | the school word (kesyon → from question); `item` is psychometric jargon; label plurals take `yo` |
| passage | tèks | `Li tèks la` school phrasing |
| section | seksyon | Haitian tests have seksyon; pinned deliberately |
| assessment | egzamen | the Haitian school exam word; `tès` kept only inside the PNP dev prose (`administrasyon tès`) |
| submit | Soumèt | naturalized from soumettre |
| finish | Fini | |
| check answer | Tcheke repons lan | check = `tcheke` (loan); answer = **repons** (`repons lan`), `repòs` = rest, rejected |
| try (noun) | esè | naturalized from essai: `{count} esè ki rete.` |
| retry / try again | Reesaye / Eseye ankò | distinct controls: réessayer → reesaye |
| loading… | Ap chaje… | progressive of the core verb `chaje` |
| tool(s) | zouti | **the core Creole word for tool**, used everywhere: `Zouti pou egzamen an` |
| panel / resize | panèl / chanje gwosè | "change the size" framing; window = `fenèt`, width = `lajè`, height = `wotè` |
| teacher | pwofesè | scored-by phrasing: `Evalyasyon fèt pa yon pwofesè` |
| calculator | kalkilatris | calculatrice → kalkilatris; debaz / syantifik / grafik |
| graph | Graf | |
| coordinate plane | plan kowòdone | plan (same form) + kowòdone (coordonnée); the math term Haitian classrooms use |
| grid | griy | grille → griy; `gri` rejected — it means gray |
| point | pwen | |
| line (drawing mode) | Liy | ligne → liy, core; endpoints named `pwen depa` / `pwen rive` |
| selector mode | Chwazi | action-name modes: Pwen, Liy, Chwazi, Efase |
| delete (graph) / clear | efase | effacer → efase, core; annotation removal is a different verb: `retire` |
| periodic table | Tablo Periyodik | tablo + periyodik; chemistry = **chimi** |
| element | elemen | élément → elemen |
| atomic number / atomic mass | nimewo atomik / mas atomik | nimewo (numéro) is the school word; both spelled out for screen readers |
| electron configuration | Konfigirasyon Elektwon | électron → elektwon |
| phase | Eta | état → eta, core Creole; values Solid / Likid / Gaz |
| element categories | Metal Alkalin, Metal Alkalin Tè, Metal Tranzisyon, Metal Pòs-Tranzisyon, Metaloyd, Nonmetal Dyatomik, Nonmetal Polyatomik, Gaz Nob, Lantanid, Aktinid | alkaline-earth rendered literally (`Metal Alkalin Tè`); gaz nob is the established Haitian rendering of noble gas |
| ruler | Règ | règle → règ, the school instrument (and rule — context carries it) |
| inches / centimeters | pous / sentimèt | **pous** (pouce) is core Creole — inch and thumb; sentimèt |
| protractor | Rapòtè | rapporteur → rapòtè, the school instrument's word in Haitian classrooms |
| degrees | degre | keep the `°` glyph |
| clockwise / counterclockwise | nan sans kadrann an / kont sans kadrann an | the calque of sans horaire through the clock-dial word kadrann (cadran); rotate = **vire** (core) |
| dictionary | Diksyonè | dictionnaire → diksyonè, core naturalized |
| entry (dictionary) | atik | the lexicographic word Haitian dictionaries use; `antre` rejected — it means entrance |
| picture dictionary | Diksyonè Imaj | picture = **imaj** |
| Spanish (language name) | panyòl | espagnol → panyòl, core (`Diksyonè Panyòl`); lowercase mid-sentence |
| line reader | Gid Lekti | guide = gid; reading = lekti (lecture); reading window = `fenèt lekti`, frame = **kadr** (cadre), obscure verb = `kouvri` |
| magnifier | Vè Agandisman | **vè** (verre, glass) + agandisman (enlargement); `loupe` → `lou` means ugly in Creole — banned homonym |
| zoom in / zoom out | Agandi / Redwi | one word per concept: agandi = make bigger (also maximize), redwi = make smaller (also minimize) — the internal-consistency choice, pinned |
| highlight(er) | Make / Makè | marquer → make, core; color values `Mak Jòn / Mak Woz / Mak Ble / Mak Vèt` with the core color words |
| underline | Souliye | souligner → souliye, the school word |
| annotate / annotation | Anote / Anotasyon | |
| read aloud | li fò | lire fort → li fò, the Creole rendering of à haute voix; read-aloud tool name = **Lekti** |
| strike through | bare | barrer → bare, **core Creole** = to cross out: `Bare Repons`, eliminated choice appends `(bare)` — no agreement needed |
| choice (answer option) | chwa | choix → chwa, core |
| clear all | Efase Tout | erase-register, distinct from `retire` (remove one annotation) |
| theme | Tèm | |
| playback speed | vitès lekti a | vitesse → vitès |
| rewind / fast-forward | Tounen An Aryè / Avanse | arrière → aryè; skip announcements are te-events: `Te avanse`, `Te tounen an aryè` |
| stop / pause / resume | sispann / kanpe / repri | three distinct core verbs pinned: `sispann` (final stop, cesser), `kanpe` (pause, halt), `repri` (resume, reprendre) |
| preview | Apèsi | aperçu → apèsi; audio preview = `Tande vwa a` |
| sample (TTS text) | egzanp | `Tèks egzanp` |
| voice (TTS) | vwa | voix → vwa, core |
| gender | sèks | values Gason / Fanm / Nètral — the natural Haitian words |
| engine (TTS) | Motè | moteur → motè; `Neural` value kept (tech value, like WaveNet/Studio); `Estanda` for standard |
| speech marks | mak pawòl | pawòl = speech/word, core |
| formula | fòmil | formule → fòmil |
| sign language | lang siny | the Haitian deaf-community term (Lang Siny Ayisyen); named languages translated `Lang Siny Ameriken/Britanik/Fransè/Grek/Meksiken`; Signed English = `Anglè Siye` |
| audio transcript | Transkripsyon | |
| update | misajou | mise à jour → **misajou**, the established Haitian tech word |
| data | done | données → done, core Creole tech word; database = **baz done** |
| browser / server | navigatè / sèvè | navigateur / serveur |
| request | demann | demande → demann, core |
| raw | bri | brut → bri (`tablo bri yo`, `done bri`) |
| summary | rezime | résumé → **rezime**; the item-list collapse control = `Montre rezime a`; the PNP provenance summary = `Rezime Orijin…` |
| match | koresponn | `Korespondans rechèch la`, matching voices = `vwa koresponn` |
| level | nivo | niveau → nivo |
| target | sib | cible → sib |
| provider | founisè | fournisseur → founisè, core |
| placement | plasman | |
| district (PNP) | distri | gloss of the US school district |
| accommodation (PNP) | akomodasyon | the Haitian education-inclusion word |
| policy | politik | |
| session | sesyon | |
| instrumentation | enstrumantasyon | record = **anrejistreman** (enregistrement), the same root as `anrejistre` (recorded) |
| environment | anviwònman | core Haitian tech word |
| timestamp | dat-lè | "date-time" — a documented coinage for a label with no established Haitian word |
| enabled / disabled / off / on | Aktive / Dezaktive / Etenn / Alim | toggle states; `Alim`/`Etenn` (allumé/éteint) are the switch-register pair used as `{state}` values |
| host (dev strings) | host | kept Latin in developer panels, like the vi/pl precedent |
| item (debug only) | item | kept Latin in developer panels; learner-facing units are `kesyon` |

## Grammar and agreement pins

- **No plural inflection.** Creole nouns do not inflect; plurality rides on
  the postposed article (`egzamen an` → `egzamen yo`) or on numerals.
  Consequences, pinned:
  - The plural groups' two categories carry **identical text** — the CLDR
    one/other split is carried because `Intl.PluralRules("ht")` selects it.
  - `{pixels} piksèl` and `{width} × {height} piksèl` are safe inline.
  - Standalone labels take `yo` where plurality is the point (`Kesyon yo`,
    `Tèks yo`, `Zouti pou egzamen an`, `paramèt yo`); singular labels keep
    the bare noun (`Kesyon`, `Tèks`).
- The postposed definite article follows its allophone rules: `la` after
  most consonants (`tèks la`, `fenèt la`, `kalkilatris la`), `a` after
  vowels (`diksyonè a`, `navigatè a`, `lekti a`), `an` after
  vowel-final/n-final nouns by common usage (`egzamen an`, `kesyon an`,
  `seksyon an`), `lan` after oral-n (`repons lan`) — common written usage
  is the arbiter where both are attested.
- Sentence-internal field labels stay lowercase: `{name}, senbòl: {symbol},
  nimewo atomik: {number}, mas atomik: {mass}, kategori: {category}`. Enum
  values stay capitalized as list entries.
- `ou` appears only where Creole grammar wants a subject (instructions,
  restoreFailed, theme unavailableStatus); it is never a politeness choice.
- Sizes join with the multiplication sign: `{width} × {height}`.
- `Graph point {id}` renders without the tool name: `Pwen {id}`, following
  the audited Dutch de-duplication.
- The Cleft construction `se … ki` renders "only … can": `se sèlman
  requiredTools item la ki ka akòde yon akomodasyon` — the natural Creole
  restrictive.

## Punctuation and glyphs

- Quotes are the French-style **guillemets « »**, Haitian typographic
  convention, including around an interpolated term: `Ap chèche «{term}»…`,
  `Pa gen atik pou «{term}».` The dev-panel single quotes around `'{id}'`
  stay verbatim from the source.
- The ellipsis is …; degrees keep °; sizes join with ×.
- Control labels and enum values are sentence-case; sentence-internal
  labels lowercase (above).

## Selection announcements (annotation live region)

The eight annotation-strip live-region keys (`selectionAvailableA11y`,
`highlightedYellow/Pink/Blue/GreenA11y`, `underlinedA11y`, `removedA11y`,
`clearedA11y`) are announcements, never rendered. Sentence shapes, pinned so
regeneration reproduces them:

- `selectionAvailableA11y` — the full two-sentence availability message:
  `Bar anotasyon tèks la disponib pou «{text}». Peze Shift+F10 pou zouti
  anotasyon yo.` (Latin `Shift+F10`; `peze` = press).
- `highlightedYellow/Pink/Blue/GreenA11y` — `te`-marked events with the core
  color words of the `Mak Jòn` family: `Te make «{text}» an jòn`
  (an woz/an ble/an vèt likewise).
- `underlinedA11y` — `te`-event of the Souliye pin: `Te souliye «{text}»`.
- `removedA11y` — `te`-event of the `Retire` pin: `Te retire anotasyon nan
  «{text}»`.
- `clearedA11y` — plural group carrying one/other with identical text per
  the no-inflection rule: `Te efase {count} anotasyon` (both) — `te`-event
  of the `Efase Tout` pin.
- The quoted selection takes « » guillemets per the punctuation rule above.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, **Hz** (Latin symbol kept in
the sample-rate values); code identifiers in the PNP prose (`assessment`,
`updateAssessment(...)`, `requiredTools`, `toolkit`); instrumentation
record kinds and session-db field names
(`all`/`event`/`error`/`metric`/`user-context`/`global-attributes`,
`assessmentId:`, `sectionId:`, `attemptId:`, `mode:`); the SSML tag named in
prose (`emphasis`); the `/api/tts` and `en-US` placeholders; dev-panel
loans the register keeps (`item`, `host`, `snapshot`, `payload`, `layout`,
`backend`, `endpoint`, `default`, `header`, `Neural`).

## Plurals — the CLDR ht categories

`Intl.PluralRules("ht")` resolves exactly two categories: **one** = the
integer 1 (and the decimal 1.0), **other** = everything else. Creole nouns
do not inflect after numerals, so each group carries `one`/`other` with
`{count}` and identical text:

- `player.formative.triesLeft`: `{count} esè ki rete.` (both)
- `tools.dictionary.entriesCount`: `{count} atik` (both)
- `tools.pictureDictionary.entriesCount`: `{count} imaj` (both)
- `debug.tts.browserAvailable`: `Sentez vwa navigatè a disponib ({count}
  vwa detekte).` (both)
- `debug.tts.pollyAvailable`: `AWS Polly disponib ({count} vwa koresponn,
  motè {engine}).` (both)
- `debug.tts.googleAvailable`: `Google Cloud TTS disponib ({count} vwa
  koresponn).` (both)

Arabic numerals everywhere; `{count}`, `{position}`, `{percent}` render as
digits. Haitian Creole is LTR; nothing here overrides direction.

## A11y strings

Keys ending `A11y` are complete, self-sufficient screen-reader sentences —
the learner hears them without seeing the layout — and every keyboard
instruction stays concrete. Latin key names stay Latin, as Haitian
keyboards print them: Shift, PageUp, PageDown, Escape, +/-, U. Ruler units
are spelled out (`pous`, `sentimèt`) because a screen reader says `cm` as
two letters.
