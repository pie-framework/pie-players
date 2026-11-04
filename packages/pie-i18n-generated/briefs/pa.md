# Punjabi, Gurmukhi (pa) brief

Serves Punjabi in the **Gurmukhi script** — the script of Indian Punjab,
where Gurmukhi is the official state script and the script of Punjabi-medium
schooling under PSEB and NCERT's Punjabi textbooks. **Shahmukhi (the
Perso-Arabic script used in Pakistani Punjab) is out of scope**: one catalog
cannot serve both scripts, the `pa` tag resolves to Gurmukhi in every major
platform locale chain, and a Shahmukhi host would need its own catalog under
a distinguishable tag (`pa-Arab`/`pnb`) with its own RTL review. The
vocabulary is the Indian-Punjab school register (ਸਵਾਲ, ਭਾਗ, ਪਾਠ, ਚਾਂਦਾ,
ਜ਼ਿਲ੍ਹਾ) — Punjabi words over Hindi/Sanskrit borrowings wherever Punjab
boards use one, with established English loans kept where Punjabi UI uses
them.

## Register

- Controls carry the plain imperative standard in Punjabi UI:
  `ਬੰਦ ਕਰੋ` (close), `ਰੱਦ ਕਰੋ` (cancel), `ਸੰਭਾਲੋ` (save), `ਜਮਾਂ ਕਰੋ`
  (submit), `ਪੂਰਾ ਕਰੋ` (finish). No pronouns: never `ਤੁਸੀਂ` — the bare
  imperative already addresses the learner politely.
- Sentences use impersonal written Punjabi: the completed-action passive
  (`… ਕੀਤਾ ਗਿਆ`, `… ਹਿਲਾਇਆ ਗਿਆ`) for state-change announcements, and
  `… ਨਹੀਂ ਹੋ ਸਕਿਆ/ਸਕੀ/ਸਕੇ` for failures, agreeing with the grammatical
  subject's gender and number (`ਸਮੱਗਰੀ … ਨਹੀਂ ਹੋ ਸਕੀ`, `ਸਵਾਲ … ਨਹੀਂ ਹੋ
  ਸਕਿਆ`). Announcements read as events, never as bare labels restating a
  control.
- The apostrophe Gurmukhi writes for the oblique form ਤੇ is kept: `… 'ਤੇ`
  (on), `… ਤੌਰ 'ਤੇ` (partly) — the ASCII `'` glyph the language itself
  uses.
- Empty states use `ਹਾਲੇ ਕੋਈ … ਨਹੀਂ` (no … yet).
- Whole sentences authored whole; no fragment assembly.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any single
string's fidelity.

| English | Punjabi | Note |
| --- | --- | --- |
| question | ਸਵਾਲ | the Punjab-school word; the Sanskritic ਪ੍ਰਸ਼ਨ is deliberately not used |
| items | ਸਵਾਲ | learner-facing regions show ਸਵਾਲ; "item" is psychometric jargon |
| passage | ਪਾਠ | the reading passage (cf. ਅਣਡਿੱਠਾ ਪਾਠ, the unseen passage of Punjab board exams) |
| section | ਭਾਗ | a delivered section of the assessment |
| assessment (delivered test) | ਮੁਲਾਂਕਣ | the Punjab education word for assessment; ਪ੍ਰੀਖਿਆ stays out except ਪ੍ਰੀਖਿਆ-ਪ੍ਰਬੰਧ (test administration) in PNP prose |
| assessment tools (toolbar) | ਮੁਲਾਂਕਣ ਦੇ ਸਾਧਨ | the toolbar's accessible name |
| tool(s) | ਸਾਧਨ | the Punjabi word; `ਟੂਲ` only inside loans (ਟੂਲਕਿੱਟ, ਟੂਲਬਾਰ, ਟੂਲ ਸੰਪਾਦਕ) |
| toolbar | ਟੂਲਬਾਰ | loan, standard |
| panel | ਪੈਨਲ | loan |
| window | ਵਿੰਡੋ | loan, standard |
| submit | ਜਮਾਂ ਕਰੋ | the exam-room verb |
| finish | ਪੂਰਾ ਕਰੋ | |
| check (verify) | ਜਾਂਚ / ਚੈੱਕ | `ਉੱਤਰ ਚੈੱਕ ਕਰੋ` for the control; ਜਾਂਚ for availability checks |
| answer | ਉੱਤਰ | the Punjabi word; ਜਵਾਬ stays out |
| try left | ਕੋਸ਼ਿਸ਼ | `{count} ਕੋਸ਼ਿਸ਼ ਬਾਕੀ ਹੈ। / {count} ਕੋਸ਼ਿਸ਼ਾਂ ਬਾਕੀ ਹਨ।` |
| settings | ਸੈਟਿੰਗਾਂ | loan, standard |
| content | ਸਮੱਗਰੀ | section/passage content (feminine — failure verbs agree ਸਕੀ) |
| loading… | ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ… | agreement follows the subject (ਸਮੱਗਰੀ → ਰਹੀ ਹੈ) |
| resize | ਆਕਾਰ ਬਦਲੋ | |
| calculator | ਕੈਲਕੁਲੇਟਰ | loan, standard; ਸਧਾਰਨ (basic), ਵਿਗਿਆਨਕ (scientific), ਗ੍ਰਾਫਿੰਗ (graphing) |
| graph | ਗ੍ਰਾਫ਼ | |
| coordinate plane | ਨਿਰਦੇਸ਼ ਅੰਕਣ | the pinned Punjab-board math term everywhere the plane is named |
| grid | ਗਰਿੱਡ | loan |
| point | ਬਿੰਦੂ | |
| line (mode) | ਰੇਖਾ | the math object; associated lines = ਜੁੜੀਆਂ ਰੇਖਾਵਾਂ |
| click / drag | ਕਲਿੱਕ ਕਰੋ / ਡ੍ਰੈਗ ਕਰੋ | loans, standard |
| delete | ਮਿਟਾਓ | |
| periodic table | ਪੀਰੀਆਡਿਕ ਸਾਰਣੀ | the loan+ਸਾਰਣੀ form Punjab chemistry uses; ਆਵਰਤ ਸਾਰਣੀ (Hindi register) stays out |
| element (chemistry) | ਤੱਤ | |
| category (element) | ਸ਼੍ਰੇਣੀ | |
| alkali / alkaline-earth metal | ਖਾਰੀ ਧਾਤ / ਖਾਰੀ ਮਿੱਟੀ ਧਾਤ | |
| transition / post-transition metal | ਸੰਕ੍ਰਮਣ ਧਾਤ / ਸੰਕ੍ਰਮਣ-ਬਾਅਦ ਦੀ ਧਾਤ | |
| metalloid | ਅਰਧਧਾਤ | the chemistry word for semimetal |
| diatomic / polyatomic nonmetal | ਦੁਇਪਰਮਾਣੂਕੀ ਗ਼ੈਰ-ਧਾਤ / ਬਹੁਪਰਮਾਣੂਕੀ ਗ਼ੈਰ-ਧਾਤ | |
| noble gas | ਨਿਸ਼ਕਿਰਿਆ ਗੈਸ | the school-chemistry word |
| symbol (element) | ਚਿੰਨ੍ਹ | |
| atomic number / atomic mass | ਪਰਮਾਣੂ ਨੰਬਰ / ਪਰਮਾਣੂ ਪੁੰਜ | spelled out for screen readers |
| electron configuration | ਇਲੈਕਟ੍ਰਾਨ ਸੰਰਚਨਾ | |
| phase (solid/liquid/gas) | ਅਵਸਥਾ | values ਠੋਸ / ਤਰਲ / ਗੈਸ (the noun, like the es brief's Gas pin) |
| ruler | ਸਕੇਲ | the school instrument's Punjabi name |
| inches / centimeters | ਇੰਚ / ਸੈਂਟੀਮੀਟਰ | |
| protractor | ਚਾਂਦਾ | the Punjab geometry set's actual name (ਡੀ, the semicircular protractor) |
| degrees | ਡਿਗਰੀ | keep the `°` glyph |
| unit | ਇਕਾਈ | |
| dictionary | ਸ਼ਬਦ-ਕੋਸ਼ | the Punjabi word for a word dictionary |
| picture dictionary | ਤਸਵੀਰੀ ਸ਼ਬਦ-ਕੋਸ਼ | picture = ਤਸਵੀਰ |
| entry (dictionary) | ਐਂਟਰੀ | loan, standard; plural ਐਂਟਰੀਆਂ |
| service (configured) | ਸੇਵਾ | |
| Spanish (language name) | ਸਪੈਨਿਸ਼ | `ਸਪੈਨਿਸ਼ ਸ਼ਬਦ-ਕੋਸ਼` |
| line reader | ਪੜ੍ਹਨ ਸਹਾਇਕ | the reading-guide tool |
| reading window / frame | ਪੜ੍ਹਨ ਵਿੰਡੋ / ਫ੍ਰੇਮ | |
| overlay | ਓਵਰਲੇ | loan |
| magnifier | ਮੈਗਨੀਫਾਇਰ | loan; magnifying lens = ਵੱਡਦਰਸ਼ੀ ਲੈੱਨਜ਼ |
| lens | ਲੈੱਨਜ਼ | |
| zoom in / zoom out | ਜ਼ੂਮ ਇਨ / ਜ਼ੂਮ ਆਉਟ | loans, standard |
| highlight(er) | ਹਾਈਲਾਈਟ ਕਰੋ / ਹਾਈਲਾਈਟਰ | loans, standard |
| underline | ਅੰਡਰਲਾਈਨ | loan, standard |
| annotate / annotation | ਟਿੱਪਣੀ | the Punjabi word for a text annotation |
| mark up | ਨਿਸ਼ਾਨਬੰਦੀ | the annotate-button's fuller clause |
| read aloud | ਉੱਚੀ ਪੜ੍ਹਨਾ | the TTS tool is ਉੱਚੀ ਪੜ੍ਹਾਈ — read-aloud phrasing, no TTS acronym in learner titles |
| playback speed | ਪੜ੍ਹਾਈ ਦੀ ਗਤੀ | for reading controls |
| pause / stop (reading) | ਠਹਿਰਾਓ / ਰੋਕੋ | ਠਹਿਰਾਓ pauses, ਰੋਕੋ stops — one verb each, never swapped |
| rewind / fast-forward | ਰਿਵਾਈਂਡ / ਫਾਸਟ-ਫਾਰਵਰਡ | loans, standard |
| strike through | ਕੱਟੋ | the answer-eliminator action (cross out), the Punjab exam-room word |
| choice (answer option) | ਵਿਕਲਪ | |
| theme | ਥੀਮ | loan; contrast = ਕੰਟ੍ਰਾਸਟ loan, the word Punjabi UI uses |
| color | ਰੰਗ | |
| voice (TTS) | ਆਵਾਜ਼ | the Punjabi word; gender rows ਮਰਦ/ਔਰਤ/ਨਿਰਪੱਖ under ਲਿੰਗ |
| sample (TTS) | ਨਮੂਨਾ | `ਨਮੂਨਾ ਲਿਖਤ`; ਪ੍ਰੀਵਿਊ stays preview |
| formula (math) | ਫਾਰਮੂਲਾ | |
| sign language | ਇਸ਼ਾਰਾ ਭਾਸ਼ਾ | the authentic Punjabi word (ਇਸ਼ਾਰਾ = gesture); the Sanskritic ਸੈਂਕੇਤਕ ਭਾਸ਼ਾ stays out |
| audio transcript | ਆਡੀਓ ਟ੍ਰਾਂਸਕ੍ਰਿਪਟ | loan, standard; region label ਟ੍ਰਾਂਸਕ੍ਰਿਪਟ |
| document | ਦਸਤਾਵੇਜ਼ | |
| teacher | ਅਧਿਆਪਕ | |
| provider | ਪ੍ਰਦਾਤਾ | the Punjabi word in dev panels too (deliberately not the loan) |
| request (dev panels) | ਬੇਨਤੀ | the Punjabi word; payload = ਪੇਲੋਡ loan |
| row (dev panels) | ਕਤਾਰ | |
| session / data / database / server | ਸੈਸ਼ਨ / ਡਾਟਾ / ਡਾਟਾਬੇਸ / ਸਰਵਰ | loans, standard in dev panels |
| environment (dev panels) | ਏਨਵਾਇਰਨਮੈਂਟ | loan for the deployment sense; ਵਾਤਾਵਰਣ means surroundings |
| event | ਇਵੈਂਟ | loan in dev panels |
| level | ਪੱਧਰ | event level |
| details | ਵੇਰਵੇ | |
| decision | ਫ਼ੈਸਲਾ | per-tool decisions = ਫ਼ੈਸਲੇ |
| diagnostics | ਨਿਦਾਨ | the Punjabi word for diagnostics |
| provenance | ਸਰੋਤ | provenance summary reads ਸਰੋਤ-ਸਾਰ (source summary) |
| profile (PNP) | ਪ੍ਰੋਫਾਈਲ | loan |
| district (PNP) | ਜ਼ਿਲ੍ਹਾ | the Punjabi administrative word; the education-sector word |
| policy (PNP) | ਨੀਤੀ | |
| support / accommodation | ਸਹੂਲਤ | what a requiredTools grant gives |
| toolkit (dev prose) | ਟੂਲਕਿੱਟ | loan, developer-facing; code identifiers (`assessment`, `updateAssessment(...)`, `requiredTools`) stay verbatim |
| host / surface | ਹੋਸਟ / ਸਤ੍ਹਾ | host loan; ਸਤ੍ਹਾ is the Punjabi word for surface |
| editor | ਸੰਪਾਦਕ | the Punjabi word (tools editor) |
| read-only | ਸਿਰਫ਼ ਪੜ੍ਹਨ ਲਈ | permissive phrase, not a calque |
| enabled / disabled / on / off | ਚਾਲੂ / ਬੰਦ | toggle-state pair everywhere, including `{state}` values |
| value / effective | ਮੁੱਲ / ਪ੍ਰਭਾਵੀ | |
| intent | ਮੰਤਵ | |
| n/a | ਲਾਗੂ ਨਹੀਂ | |

## Numerals (pinned decision)

**Western Arabic digits everywhere, including authored prose.** Modern
Punjabi software UI — Windows pa-IN, Android pa-Guru, web apps — renders
digits in the Western set, and assessment platforms that serve Punjabi do
the same, even though Gurmukhi numerals (੦–੯) appear in Punjabi-medium print
materials. The catalog therefore writes 180 ਡਿਗਰੀ, ਹਰ 10 ਡਿਗਰੀ, 1 ਸ਼ਾਮਲ ਕਰੋ
in ASCII digits, so interpolated placeholders (`{count}`, `{position}`,
`{degrees}`) never sit next to a different digit system. Technical/literal
keys stay ASCII verbatim: sample rates (`8000 Hz`), MP3/OGG/PCM, `/api/tts`,
`en-US`, HTTP placeholders, JSON field identifiers. The `°` and `×` glyphs
survive.

## Script and orthography

- Gurmukhi throughout, with the subjoined forms written where words demand
  them: ਿੱ/ੁੱ addhak pairs (ਸਿੱਟਾ, ਕੱਟੋ, ਠੀਕ), bindi (ਗ਼, ਫ਼, ਜ਼) on the
  Perso-Arabic loans Punjabi spells with them (ਗ਼ਲਤੀ, ਫ਼ੈਸਲੇ, ਜ਼ਿਲ੍ਹਾ),
  and ਯ-ful forms per PSEB orthography.
- One space between Punjabi words; no space between a word and its
  postposition-particle punctuation. The oblique marker keeps the ASCII
  apostrophe: `… 'ਤੇ`, `ਤੌਰ 'ਤੇ`.
- Quotes: the curly “” glyphs survive from the English source, and the
  dictionary lookup notices keep “{term}”. The provider-id strings keep the
  ASCII single quotes the English has: `'{id}'`. The eliminated-choice
  marker keeps ASCII parentheses: `(ਹਟਾਇਆ ਗਿਆ)`.

## Plurals

- CLDR `pa` carries `one`/`other`. All six plural groups carry both
  categories with `{count}` in each.
- Punjabi does plural-mark where the grammar demands it, and the groups use
  the real forms: `{count} ਕੋਸ਼ਿਸ਼ ਬਾਕੀ ਹੈ।` vs `{count} ਕੋਸ਼ਿਸ਼ਾਂ ਬਾਕੀ
  ਹਨ।`, `{count} ਐਂਟਰੀ` vs `{count} ਐਂਟਰੀਆਂ`, `{count} ਮਿਲਦੀ ਆਵਾਜ਼` vs
  `{count} ਮਿਲਦੀਆਂ ਆਵਾਜ਼ਾਂ`.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz, and the code
identifiers inside dev prose (`assessment`, `requiredTools`,
`updateAssessment(...)`, `assessmentId:`, `sectionId:`, `attemptId:`,
`mode:`, the instrumentation record kinds `all`/`event`/`error`/
`metric`/`user-context`/`global-attributes`).

## A11y strings

Keys ending `A11y` are screen-reader operating instructions. Translate them
as complete, self-sufficient sentences — the learner hears them without
seeing the layout — and keep every keyboard instruction concrete. Latin key
names stay Latin where that is how Punjabi keyboards label them: Shift,
PageUp, PageDown, Escape, +/-, U; arrow keys are ਐਰੋ ਕੀਆਂ.
