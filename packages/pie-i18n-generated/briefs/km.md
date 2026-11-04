# Khmer (km) brief

Generated-tier locale for Khmer, the state language of Cambodia. Khmer
assessment terminology is only partially standardized; this brief records
deliberate choices and flags every judgment call under **Terminology
confidence** so a native reviewer knows where to look first. A native pass
remains strongly advised before promotion beyond the generated tier.

## Register

- Neutral-formal written Khmer, as Cambodian assessment and e-learning
  software uses.
- **No second-person pronouns.** Khmer pronouns encode gender and social
  register, so UI text avoids them: controls carry the bare verb
  (`បិទ`, `សាកល្បងម្តងទៀត`), sentences use impersonal phrasing
  (`មិនអាច…បានទេ`, `ត្រូវបាន…`), and the one possessive English forces
  ("your saved answers") renders impersonally (`ចម្លើយដែលបានរក្សាទុក…`).
- State-change announcements (a calculator opening, a tool moving or
  rotating) are events: `បានបើក…`, `បានផ្លាស់ទី…ឡើងលើទៅ {position}` —
  the completed-action `បាន` form, never a state description.
- Full sentences rather than fragments wherever English uses a full
  sentence; short labels stay short. Khmer has no capitalization, so the
  English sentence-case/label-case distinction carries no signal — match
  length and register, not capitalization.
- Sentences end with the Khmer khan ។; the ASCII colon `:` and Western
  `?` are kept (no locale in this package uses the Khmer ៖).
- Developer panel chrome (`debug.*`) renders its own register freely —
  lowercase dev-panel labels in English are normal words in Khmer.

## Script and orthography

- Khmer script throughout, with correct subscript (ជើងអក្សរ) consonant
  forms (`ក្រ`, `ស្ត`, `គ្រ`); no zero-width joiners or spacers are
  inserted by hand — Unicode line breaking handles Khmer word
  boundaries, and interposing ZWSP/ZWNJ breaks rendering in older Khmer
  fonts.
- **No inter-word spaces** (like Thai): Khmer writes word compounds
  solid. A space appears only between clauses, before a sentence-final
  ក្នុង/ដើម្បី clausal break where Khmer orthography puts one, and around
  Latin-script terms and numerals (`PageUp ឬ PageDown`, `ទី {position}`).
- **Arabic digits everywhere** (`{count}`, `{position}`, `{degrees}`
  render as digits; Khmer numerals ០-៩ are never written into catalogs).
  Khmer numerals remain for nothing; the ordinal marker ទី attaches to
  Arabic digits (`សំណួរទី {position}`).
- Latin key names are kept where keyboards label them so: Shift,
  PageUp, PageDown, Escape, +/-, U. Arrow keys are spelled out
  (`គ្រាប់ចុចទ្រនិចព្រួញ`) because a screen reader says "cm"-style
  abbreviations letter by letter.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any
single string's fidelity: the learner must see one word for one concept
everywhere.

| English | Khmer | Note |
| --- | --- | --- |
| question | សំណួរ | a delivered question; `items` also renders សំណួរ — "item" is psychometric jargon no Cambodian classroom uses |
| passage | អត្ថបទ | a reading text (`អត្ថបទ` = text; the reading-passage sense per contextual usage) |
| section | ផ្នែក | a part of a test (`ផ្នែកទី {position}`) |
| answer | ចម្លើយ | noun; the verb "answer" is ឆ្លើយ |
| check answer | ពិនិត្យចម្លើយ | |
| submit | បញ្ជូន | the hand-in/send verb Khmer e-learning uses; `ដាក់` alone reads "put" |
| finish | បញ្ចប់ | |
| score | ពិន្ទ | `ដាក់ពិន្ទ` = score something |
| settings | ការកំណត់ | |
| tool(s) | ឧបករណ៍ | |
| toolbar | របារឧបករណ៍ | |
| panel | បន្ទះ | |
| window | បង្អួច | |
| tab | ផ្លាក | Khmer UI convention (see confidence list) |
| loading… | កំពុងផ្ទុក… | |
| calculator | ម៉ាស៊ីនគិតលេខ | basic = ធម្មតា, scientific = វិទ្យាសាស្ត្រ, graphing = ក្រាហ្វ |
| graph | ក្រាហ្វ | loanword, standard in Khmer math |
| coordinate plane | ប្លង់ចត្រង្គ | native compound (see confidence list) |
| grid | ក្រឡាចត្រង្គ | the Khmer word for a gridded lattice |
| opacity | តម្លាភាព | transparency — Khmer surfaces opacity as translucency |
| point | ចំណុច | |
| line | បន្ទាត់ | |
| connected lines | បន្ទាត់ដែលភ្ជាប់ | unified for both "associated" and "connected" in the graph hints |
| delete | លុប | |
| select | ជ្រើសរើស | |
| periodic table | តារាងធាតុគីមី | shortened from Khmer Wikipedia's តារាងខ្លឹមសារធាតុគីមី (see confidence list) |
| element | ធាតុ | |
| atom / electron | អាតូម / អេឡិចត្រុង | transliterations, standard in Khmer science |
| phase | ដំណាក់កាល | solid រឹង, liquid រាវ, gas ឧស្ម័ន |
| metal | លោហធាតុ | |
| ruler | ឧបករណ៍វាស់ | see confidence list — the contested headword |
| protractor | ឧបករណ៍វាស់មុំ | the angle-measuring instrument |
| inch / centimeter | អុិនឈ៍ / សង់ទីម៉ែត្រ | transliterations, as Cambodian school supplies are labelled |
| dictionary | វចនានុក្រម | |
| entry (dictionary) | ពាក្យ | counted as words: `{count} ពាក្យ` |
| picture dictionary | វចនានុក្រមរូបភាព | |
| Spanish (language name) | អេស្ប៉ាញ | `វចនានុក្រមភាសាអេស្ប៉ាញ` |
| line reader | ឧបករណ៍ជួយអាន | the reading-guide tool |
| reading window | បង្អួចអាន | |
| frame | ស៊ុម | the obscuring frame |
| magnifier | កញ្ចក់ពង្រីក | the enlarging lens |
| zoom in / zoom out | ពង្រីក / បង្រួម | native enlarge/shrink, as Khmer UI uses |
| highlight(er) | បន្លិច / ឧបករណ៍បន្លិច | |
| underline | គូសបន្ទាត់ក្រោម | draw-a-line-under; NOT គូសបញ្ជាក់ពាក្យ, which reads "emphasize" |
| strike through | គូសបន្ទាត់ឆ្លងកាត់ | the answer-eliminator action |
| annotation | ការសម្គាល់ | `សម្គាល់` = mark/annotate |
| theme | ប្រធានបទ | the Khmer rendering "Theme" has converged on (see confidence list) |
| contrast | កម្រិតពណ៌ | color level, as Khmer surfaces the concept (see confidence list) |
| read aloud | អានឡើងសំឡេង | the read-aloud phrasing everywhere, including the TTS tool name — no transliteration of "text to speech" |
| playback speed | ល្បឿននៃការអាន | for reading controls |
| voice | សំឡេង | a TTS voice; Khmer covers audio and voice with one word |
| rewind / fast-forward | ដកថយ / រំកិលទៅមុខ | |
| sign language | ភាសាសញ្ញា | |
| audio transcript | ប្រតិចារិក | the Khmer word for a transcript |
| pixels | ភីកសែល | |
| degrees | ដឺក្រេ | keep the `°` glyph where English has it |
| drag | អូស | |
| rotate | បង្វិល | clockwise = តាមទ្រនិចនាទី (following the clock hands) |
| arrow key | គ្រាប់ចុចទ្រនិចព្រួញ | spelled out for screen readers |
| assessment | ការវាយតម្លៃ | the formal education word; toolkit = សំណុំឧបករណ៍ |
| host (the embedding surface) | ម្ចាស់ផ្ទះ | the "house owner" Khmer uses for host, like es `anfitrión` |
| service (provider) | សេវា / អ្នកផ្គត់ផ្គង់ | service / provider |

## Terminology confidence

Khmer assessment vocabulary is partially standardized. These are the
judgment calls a native reviewer should check first, in rough priority
order:

1. **ruler → ឧបករណ៍វាស់** (measuring tool). English→Khmer evidence
   splits: Wiktionary and contextual machine output render the
   instrument as **បន្ទាត់**, which is also Khmer's ordinary word for
   "line" — colliding with the graph's Line mode (`បន្ទាត់`). The
   descriptive ឧបករណ៍វាស់ was chosen to avoid the collision; if a
   Cambodian school term exists (the protractor pair ឧបករណ៍វាស់ /
   ឧបករណ៍វាស់មុំ was built for that reason), the ruler row should move
   to it in review.
2. **coordinate plane → ប្លង់ចត្រង្គ** (grid plane). Khmer math
   textbooks may carry a coordinate-specific term (a
   `កូអរដោនេ`-family loan from French *coordonnées* circulates in
   secondary-school materials but could not be verified in a corpus).
   ប្លង់ចត្រង្គ is native and transparent; both terms are review
   candidates.
3. **periodic table → តារាងធាតុគីមី**, a deliberate shortening of Khmer
   Wikipedia's តារាងខ្លឹមសារធាតុគីមី for a toolbar label. Review may
   prefer the full form or another textbook rendering.
4. **theme → ប្រធានបទ** and **contrast → កម្រិតពណ៌** (color level).
   ប្រធានបទ is the topic/theme word Khmer interfaces use for "Theme",
   and កម្រិតពណ៌ is how the contrast concept surfaces in Khmer output —
   but neither has a strong Khmer UI precedent for this exact control.
   The theme description is worded ("themes and color levels for easy
   viewing") so the pair reads naturally.
5. **yes → ព្រម** (agree/willing). Khmer's direct yes forms
   (បាទ/ចាស) are gender- and register-marked, which the register rule
   forbids; ព្រម reads as consent, which is what the button means.
   Review may prefer យល់ព្រម for `ok` (used) and something else for
   `yes`.
6. **pink → ពណ៌ស្វាយចន្ទី.** The orchid/magenta color word; used for the
   pink highlight. Verify against Cambodian color naming.
7. **partly correct → ត្រូវមួយផ្នែក** (correct one part) — a plain
   compound for a phrase Khmer tests rarely render verbatim.
8. **session → សេសសុន, tab → ផ្លាក, panel → បន្ទះ, snapshot →
   រូបភាពស្ថានភាព, instrumentation → ការតាមដាន** — developer-panel
   nouns without strong Khmer precedents; transliteration or
   descriptive compounds chosen over English.
9. **neural → ញ៉ឺរ៉ាល, floating overlay → ស្រទាប់អណ្តែត, semicolon →
   ចុចផ្អែម** — transliterations/compounds flagged as review items; the
   semicolon name especially (ចុចផ្អែម is more strictly "full stop").
10. **coordinator → កម្មវិធីសម្របសម្រួល, determination → ការកំណត់,
    canonical → ស្តង់ដារ, intent → គោលបំណង** — dev-panel register
    choices, visible only in the debug panels.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud
TTS, Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz. A Khmer
sentence may surround them with spaces per orthography; code
identifiers in the PNP debugger body (`assessment`, `requiredTools`,
`updateAssessment(...)`) stay verbatim like every locale.

## Numbers, plurals, direction

- Arabic numerals everywhere; `{count}`, `{position}`, `{degrees}`
  render as digits, never Khmer numerals.
- CLDR Khmer has a single plural category, `other` (verified against
  `Intl.PluralRules("km")`: `pluralCategories: ["other"]` for 0, 1, 2,
  5, 11, 21, 100). All six plural groups carry `other` only, with
  `{count}` inside it.
- Khmer is LTR; nothing here overrides direction.

## A11y strings

Keys ending `A11y` are screen-reader operating instructions. Translate
them as complete, self-sufficient sentences — the learner hears them
without seeing the layout — and keep every keyboard instruction
concrete. Latin key names stay where Khmer keyboards label them that
way: Shift, PageUp, PageDown, Escape, +/-, U.
