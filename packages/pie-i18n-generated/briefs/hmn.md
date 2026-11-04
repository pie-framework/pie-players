# White Hmong (hmn) brief

Generated-tier locale for White Hmong (Hmong Daw) in the Romanized
Popular Alphabet (RPA), the variety and orthography of US Hmong-English
school materials. Hmong assessment terminology is not standardized in
the way the reviewed locales' is; this brief records deliberate choices
and flags every judgment call under **Terminology confidence** so a
native reviewer knows where to look first. A native pass remains
strongly advised before promotion beyond the generated tier.

## Dialect decision

White Hmong (Hmong Daw), the variety spoken by the large majority of
Hmong-American students and the basis of every US Hmong-English school
glossary. Not Green Mong (Hmong Njua), whose RPA spelling differs in
the aspiration markers and several diphthongs. The catalog registers
under the bare `hmn` tag; a Green-Mong host would supply its own
messages.

## Register

- Neutral written Hmong, as Hmong-language classroom materials and
  Hmong-English assessment supports use: plain verbs, completed events
  marked with `lawm`, no politeness particles (Hmong has none).
- Controls carry the bare verb (`Kaw`, `Sim dua`); sentences prefer
  impersonal phrasing (`Tsis thauj tau…`, `Tsis ua tau`), and the one
  possessive English forces ("your saved answers") uses `koj` because
  Hmong requires it there (`koj cov lus teb uas khaws cia`).
- State-change announcements (a calculator opening, a tool moving or
  rotating) are events: `Tshuab xam zauv yooj yim qhib lawm`,
  `Tsav mus sab saum txog {position}` — never a bare state
  description.
- Full sentences rather than fragments wherever English uses a full
  sentence; short labels stay short.

## Code-switch policy

US Hmong school materials code-switch freely, and the catalog follows
that usage rather than inventing compounds. A term stays English where
Hmong-US classrooms keep it English:

- structural UI nouns with no established Hmong word: `tab`, `panel`,
  `screen`, `scroll`, `frame`, `backend`, `arrow keys` (kept inside
  Hmong sentences — `Rub daim panel`, `Scroll mus qab`);
- the periodic table tool's chemistry nomenclature (`Periodic Table`,
  `Atomic Mass`, `Transition Metal`, …), which US science instruction
  delivers in English — with the everyday-word exception of the phases
  (solid `Tawv`, liquid `Dej`, gas `Pa`) and phase (xeeb);
- foreign-language names without entrenched Hmong forms (`Spanish`,
  `British`, `Greek`, `Mexican` — `Asmeslivkas` and `Fabkis` are
  translated because those Hmong names are entrenched);
- length units (`Inches`, `Centimeters`), taught and said in English.

Everything else is translated; when a descriptive Hmong compound was
required it is listed under Terminology confidence.

## Orthography

- RPA tone markers must be correct on every word: `-b` (high), `-j`
  (falling), `-v` (rising), `-s` (creaky), `-g` (breathey), `-m`
  (low), and unmarked mid-rising. Every word below carries its tone
  marker; a review pass should check no marker was dropped.
- Hmong is written with spaces between every word (unlike Thai/Khmer;
  unlike Lao, spaces are per-word, not per-phrase).
- The RPA double letters (`ts`, `nt`, `np`, `xy`, `hn`, `hm`, `rh`)
  and digraph vowels (`ee`, `ai`, `au`, `aw`, `oo`, `wb`) are single
  sounds; no re-spelling.
- Punctuation is Western throughout: sentences end with `.`, `?` where
  English has one.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any
single string's fidelity: the learner must see one word for one
concept everywhere.

| English | Hmong | Note |
| --- | --- | --- |
| question | kev nug | a delivered question; `items` also renders kev nug — "item" is psychometric jargon |
| passage | tsab xovntawv | a text/article to read (see confidence list) |
| section | feem | a part of a test (`Feem {position} ntawm {total}`) |
| answer | lus teb | noun; verb = teb |
| check answer | kuaj lus teb | kuaj = check/test |
| submit | xa | send/hand in |
| finish | ua tiav | |
| teacher | xib fwb | |
| score | ntsuam xyuas | in the scoring sense the catalog needs; evaluate |
| settings | kev teeb tsa | teeb tsa = set up |
| tool(s) | khoom siv | things-used = tools/equipment |
| toolbar | cov khoom siv / txoj kab khoom siv | per surface; see confidence list |
| panel | daim panel | code-switch per policy |
| window | qhov rais | |
| tab | tab | code-switch per policy |
| loading… | Tab tom thauj… | thauj = transport/load |
| calculator | tshuab xam zauv | xam = calculate, zauv = number |
| calculator variants | … yooj yim / … txuj ci / … duab | basic (simple), scientific (txuj ci = science/knowledge), graphing (duab = picture) |
| graph | daim phiaj | phiaj = picture/map/chart (see confidence list) |
| coordinate plane | daim duab kab zauv | number-line drawing (descriptive; see confidence list) |
| grid | cov kab | the lines (descriptive; see confidence list) |
| point | taw tes | machine-dictionary rendering of "point"; see confidence list |
| line | kab | |
| draw | kos | |
| delete | rho tawm | pull out |
| select | xaiv | |
| periodic table | Periodic Table | English per code-switch policy |
| phase | xeeb | state/appearance; solid = Tawv, liquid = Dej, gas = Pa |
| ruler | tus kav | kav = measure length (see confidence list) |
| protractor | tus ntsuas kaum sab xis | angle (kaum sab xis) measurer; see confidence list |
| angle | kaum sab xis | machine-dictionary rendering; see confidence list |
| inches / centimeters | Inches / Centimeters | English per code-switch policy |
| dictionary | phau ntawv txhais lus | defining-words book |
| entry (dictionary) | daim lus txhais | counted: `{count} daim lus txhais` |
| picture dictionary | phau ntawv duab | picture book; see confidence list |
| Spanish | Spanish | code-switch per policy (`phau ntawv txhais lus Spanish`) |
| line reader | kev pab nyeem kab | reading-lines aid |
| reading window | qhov rais nyeem | |
| frame | frame | code-switch per policy |
| magnifier | iav pab saib | helping-see glass |
| zoom in / out | ua kom loj / ua kom me | enlarge/shrink; `zoom` kept in code-switch contexts per policy |
| highlight | ua xim | make-color; see confidence list |
| underline | kab qab | bottom-line; see confidence list |
| strike through | ua kab hla | cross-line; hla = cross over |
| annotation | kev sau cim | mark-writing |
| theme | hom xim | color style; see confidence list |
| contrast | qhov sib txawv xim | color difference; see confidence list |
| read aloud | nyeem tawm suab | the read-aloud phrasing everywhere, including the TTS tool name |
| playback speed | kev ceev nyeem | ceev = fast |
| voice | suab hais | speaking voice; bare suab stays "audio" |
| rewind / fast-forward | rov qab / mus tom ntej | |
| sign language | lus tes | hand language; see confidence list |
| audio transcript | ntawv sau cov suab | written record of the sounds |
| pixels | pixels | code-switch per policy |
| degrees | deg | keep the `°` glyph where English has it |
| drag | rub | pull/drag |
| rotate | tig | clockwise = raws tus moos (following the clock), counterclockwise = rov tus moos; see confidence list |
| left / right | sab laug / sab xis | |
| up / down | sab saum / sab qab | |
| center | nruab nrug | |
| all | txhua / tag nrho | txhua for "All", tag nrho for "full/complete" |
| assessment | kev ntsuam xyuas | examination/evaluation |
| toolkit | toolkit | kept in compound labels (debug panel only) |
| host (the embedding surface) | host | code-switch per policy (debug panel only) |

## Terminology confidence

Hmong assessment vocabulary is not standardized. These are the judgment
calls a native reviewer should check first, in rough priority order:

1. **passage → tsab xovntawv.** In everyday Hmong tsab xovntawv leans
   "article/newspaper piece"; US bilingual classrooms also use it for
   "text to read". Review may prefer `tsab ntawv nyeem` or
   `daim ntawv nyeem`.
2. **angle → kaum sab xis, protractor → tus ntsuas kaum sab xis.**
   Machine-dictionary rendering for "angle" (literally "ten-side
   right"?); the compound is not verified against Hmong math
   instruction. If a native term exists, the protractor name, its
   description and the rotate strings follow it.
3. **point → taw tes.** Machine-dictionary rendering (literally
   "hand-point", the pointing gesture) used for a graph point. A Hmong
   math term would displace it in the graph tool's four point strings.
4. **correct → tseeb.** Dictionary-backed ("true"); verify the
   formative-outcome register (`Tseeb.`, `Tsis tseeb.`,
   `Tseeb ib feem.`).
5. **yes/no → Yog / Tsis yog.** Hmong has no bare yes/no; these are
   the school-materials convention. Review may prefer `Yawm` for yes.
6. **ok → Zoo lawm, cancel → Tso tseg, save → Khaws cia, reset →
   Rov teeb dua, apply → Ua raws, preview → Kuaj saib, author → Sau**
   — common verbs without established Hmong UI forms; descriptive
   choices flagged for review, `Ua raws` (apply) especially.
7. **highlight → ua xim** (make-color). Machine output keeps English
   "highlight"; the Hmong compound was preferred for consistency with
   the translated underline. The four highlight colors: yellow `daj`,
   pink `liab` (machine output renders pink as red — no distinct pink
   word was verifiable; review should supply one), blue `xiav`,
   green `ntsuab`.
8. **underline → kab qab** — "bottom line"; a verbal compound
   (`ua kab qab`) appears inside A11y sentences.
9. **clockwise/counterclockwise → raws tus moos / rov tus moos**
   (following/against the clock) — descriptive, since machine output
   keeps "clockwise" English.
10. **theme → hom xim, contrast → qhov sib txawv xim** — color-style
    and color-difference compounds; no Hmong UI precedent exists.
11. **sign language → lus tes** — hand language; verify against
    Hmong deaf-community usage (they may keep "sign language").
12. **calculator variants → txuj ci (scientific), duab (graphing)** —
    txuj ci is the Hmong science/knowledge word machine output uses
    for science class; duab (picture) stands in for "graphing".
13. **voice → suab hais, paused → Nres ib nti lawm, entry → daim lus
    txhais, picture dictionary → phau ntawv duab** — smaller register
    choices flagged for review.
14. **any → Ib yam dab tsi** — "something/any one"; verify the filter
    and gender-"Any" register.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud
TTS, Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz, plus the
code-switch set above (tab, panel, screen, scroll, frame, backend,
arrow keys, Periodic Table nomenclature, Inches/Centimeters, Spanish).
Code identifiers in the PNP debugger body (`assessment`,
`requiredTools`, `updateAssessment(...)`) stay verbatim like every
locale.

## Numbers, plurals, direction

- Arabic numerals everywhere; `{count}`, `{position}`, `{degrees}`
  render as digits.
- CLDR `hmn` is undersourced: its plural data is minimal, and
  `Intl.PluralRules("hmn")` resolves a single category, `other`
  (verified for 0, 1, 2, 5, 11, 21, 100). All six plural groups carry
  `other` only, with `{count}` inside it. A reviewer should not read
  the missing `one` as an error.
- Hmong is LTR; nothing here overrides direction.

## A11y strings

Keys ending `A11y` are screen-reader operating instructions. Translate
them as complete, self-sufficient sentences — the learner hears them
without seeing the layout — and keep every keyboard instruction
concrete. Key names stay as US Hmong keyboards label them: Shift,
PageUp, PageDown, Escape, +/-, U, and "arrow keys" in English per the
code-switch policy.
