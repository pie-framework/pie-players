# Lao (lo) brief

Generated-tier locale for Lao, the state language of Laos. Lao assessment
terminology is only partially standardized; this brief records deliberate
choices and flags every judgment call under **Terminology confidence** so a
native reviewer knows where to look first. A native pass remains strongly
advised before promotion beyond the generated tier.

## Register

- Neutral-formal written Lao, as Lao assessment and e-learning software
  uses.
- **No politeness particles.** Never ແດ່, ນະ or ນຳ sentence endings:
  Lao UI text conventionally omits them, and picking a register-marked
  form would speak for the learner.
- Controls carry the bare verb (`ປິດ`, `ລອງໃໝ່`); sentences prefer
  impersonal phrasing (`ບໍ່ສາມາດ…ໄດ້`, `ບໍ່ສຳເລັດ`). Lao has no
  gendered pronoun problem, but UI text still avoids ເຈົ້າ/ທ່ານ — the
  one possessive English forces ("your saved answers") renders
  impersonally (`ຄຳຕອບທີ່ບັນທຶກໄວ້…`).
- State-change announcements (a calculator opening, a tool moving or
  rotating) are events: `ເປີດເຄື່ອງຄິດເລກພື້ນຖານແລ້ວ`,
  `ຍ້າຍຂຶ້ນເຖິງ {position}ແລ້ວ` — the completed-action ແລ້ວ form, never a
  state description.
- Full sentences rather than fragments wherever English uses a full
  sentence; short labels stay short. Lao has no capitalization, so the
  English sentence-case/label-case distinction carries no signal —
  match length and register, not capitalization.
- Sentences end with the Western period `.` (modern Lao practice; the
  traditional ຯ is not used), and Western `?` where English has one.

## Script and orthography

- Lao script throughout, with modern spellings: ໃໝ່ (not ໃໝ່ຍ),
  ຮູບພາບ, and the ຼ semivowel series where standard (ໂຫຼດ, ແຫຼວ,
  ຫຼາຍ). The old U+0EB3 forms (ໍາ) are normalized to ຳ throughout.
- **Spaces at phrase boundaries, not between every word.** Lao
  orthography writes compounds solid (`ເຄື່ອງຄິດເລກ`, `ການຕັ້ງຄ່າ`) and
  puts a space between phrases and clauses, and around numerals and
  Latin-script terms (`ພາກທີ {position} ໃນ {total}`, `Shift ແລະ ລູກສອນ`).
  This is the rule applied throughout: no word-by-word spacing (that is
  Thai/Khmer behaviour, not Lao), no clause-length unbroken runs.
- **Arabic digits everywhere** (`{count}`, `{position}`, `{degrees}`
  render as digits, never Lao numerals).
- Latin key names are kept where keyboards label them so: Shift,
  PageUp, PageDown, Escape, +/-, U. Arrow keys are spelled out
  (`ລູກສອນ`) because a screen reader says abbreviations letter by
  letter.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any
single string's fidelity: the learner must see one word for one concept
everywhere.

| English | Lao | Note |
| --- | --- | --- |
| question | ຄຳຖາມ | a delivered question; `items` also renders ຄຳຖາມ — "item" is psychometric jargon |
| passage | ບົດອ່ານ | a reading passage |
| section | ພາກ | a part of a test (`ພາກທີ 1` = Part 1) |
| answer | ຄຳຕອບ | |
| check answer | ກວດຄຳຕອບ | |
| submit | ສົ່ງ | short form; `ສົ່ງຄຳຕອບ` only inside a whole phrase |
| finish | ສຳເລັດ | |
| settings | ການຕັ້ງຄ່າ | |
| tool(s) | ເຄື່ອງມື | |
| toolbar | ແຖບເຄື່ອງມື | |
| panel | ແຜງ | |
| window | ໜ້າຕ່າງ | |
| tab | ແທັບ | loanword, standard in Lao UI |
| loading… | ກຳລັງໂຫຼດ… | |
| calculator | ເຄື່ອງຄິດເລກ | basic = ພື້ນຖານ, scientific = ວິທະຍາສາດ, graphing = ກຣາຟ |
| graph | ເສັ້ນສະແດງ | the native Lao coinage (see confidence list; ກຣາຟ loanword is the alternative) |
| coordinate system/plane | ລະບົບພິກັດ | ພິກັດ is Lao's coordinate word (Lao Wikipedia: ພິກັດພູມສາດ); "plane" renders as the coordinate system |
| grid | ເສັ້ນຕາຕະລາງ | the graph's line table (see confidence list) |
| opacity | ຄວາມໂປ່ງໃສ | translucency, as Lao surfaces the concept |
| point | ຈຸດ | |
| line | ເສັ້ນ | |
| associated/connected lines | ເສັ້ນທີ່ຕິດພັນ / ເສັ້ນທີ່ຕໍ່ກັບມັນ | one concept, one family; unified in review if flagged |
| delete | ລຶບ | |
| select | ເລືອກ | |
| periodic table | ຕາຕະລາງທາດ | the Lao Wikipedia title |
| element | ທາດ | |
| atom / electron | ປະລຳ / ເອເລັກໂຕຣນິກ | Lao science vocabulary |
| phase | ສະພາບ | solid ແຂງ, liquid ແຫຼວ, gas ອາຍ |
| metal | ໂລຫະ | nonmetal = ອະໂລຫະ |
| ruler | ໄມ້ບັນທັດ | the Lao-Thai shared instrument name (Wiktionary + dictionary evidence) |
| protractor | ໄມ້ວັດມຸມ | the angle-measuring instrument (Thai-cognate compound; see confidence list) |
| inch / centimeter | ນິ້ວ / ຊັງຕີແມັດ | ນິ້ວ is the unit as Lao presents inches — same choice as audited Thai นิ้ว |
| dictionary | ວັດຈະນານຸກົມ | |
| entry (dictionary) | ຄຳສັບ | counted as words: `{count} ຄຳສັບ` |
| picture dictionary | ວັດຈະນານຸກົມຮູບພາບ | |
| Spanish (language name) | ສະເປນ | `ວັດຈະນານຸກົມພາສາສະເປນ` |
| line reader | ເຄື່ອງມືຊ່ອຍອ່ານ | the reading-guide tool |
| reading window | ໜ້າຕ່າງອ່ານ | |
| frame | ກອບ | the obscuring frame |
| magnifier | ແວ່ນຂະຫຍາຍ | the enlarging lens |
| zoom in / zoom out | ຂະຫຍາຍ / ຫຍໍ້ | native enlarge/shrink |
| highlight | ເນັ້ນໃສ່ | emphasize, as Lao renders "highlight"; highlighter tool = ເຄື່ອງມືເນັ້ນໃສ່ |
| underline | ຂີດເສັ້ນໃຕ້ | draw-a-line-under |
| strike through | ຂີດເສັ້ນຂ້າມ | the answer-eliminator action |
| annotation | ການໝາຍເຫດ | ໝາຍເຫດ = mark/note |
| theme | ຮູບແບບ | style/appearance (see confidence list; ຫົວຂໍ້ "topic" is the machine-output alternative) |
| contrast | ຄວາມກົງກັນຂ້າມ | opposite-facing, the Lao rendering of the concept |
| read aloud | ອ່ານອອກສຽງ | the read-aloud phrasing everywhere, including the TTS tool name — no transliteration of "text to speech" |
| playback speed | ຄວາມໄວການອ່ານ | for reading controls |
| voice | ສຽງເວົ້າ | a TTS voice; bare ສຽງ stays "audio" |
| rewind / fast-forward | ຍ້ອນກັບ / ຂ້າມໄປໜ້າ | |
| sign language | ພາສາມື | hand language (see confidence list) |
| audio transcript | ບົດບັນທຶກສຽງ | a sound record/transcript |
| pixels | ພິກເຊວ | |
| degrees | ອົງສາ | keep the `°` glyph where English has it |
| drag | ລາກ | |
| rotate | ໝູນ | clockwise = ຕາມເຂັມໂມງ (following the clock hand), counterclockwise = ຍ້ອນເຂັມໂມງ |
| arrow key | ລູກສອນ | spelled out for screen readers |
| assessment | ການປະເມີນ | the formal education word; toolkit = ຊຸດເຄື່ອງມື |
| host (the embedding surface) | ເຈົ້າບ້ານ | the "house owner" Lao uses for host |
| service (provider) | ບໍລິການ / ຜູ້ໃຫ້ບໍລິການ | service / provider |

## Terminology confidence

Lao assessment vocabulary is partially standardized. These are the
judgment calls a native reviewer should check first, in rough priority
order:

1. **protractor → ໄມ້ວັດມຸມ.** Attested only in secondary sources; it
   is the exact Thai-cognate compound (Thai pinned ไม้วัดมุม), but Lao
   may use a different school term. Highest-visibility review item.
2. **graph → ເສັ້ນສະແດງ** ("display line/chart"), the native coinage
   dictionary output gives. Lao math also uses the ກຣາຟ loanword;
   review should pick one and unify (the catalog uses ກຣາຟ only inside
   the graphing-calculator name).
3. **grid → ເສັ້ນຕາຕະລາງ** — descriptive compound; Lao has no
   established graph-grid word.
4. **theme → ຮູບແບບ** (style/appearance) over ຫົວຂໍ້ (topic), because
   this control changes appearance. No strong Lao UI precedent either
   way.
5. **contrast → ຄວາມກົງກັນຂ້າມ** ("oppositeness") — dictionary-backed
   but reads abstract; review may prefer a color-specific phrase.
6. **sign language → ພາສາມື** (hand language). Plausible Lao naming;
   verify against Lao deaf-community usage.
7. **rotate → ໝູນ, clockwise → ຕາມເຂັມໂມງ** — spin/follow-the-clock
   phrasing; verify the verb against Lao math-instruction usage.
8. **session → ເຊດຊັນ, tab → ແທັບ, panel → ແຜງ, snapshot → ຮູບພາບສະພາບ,
   instrumentation → ການຕິດຕາມ** — developer-panel nouns without strong
   Lao precedents; transliteration or descriptive compounds chosen
   over English.
9. **Spanish → ສະເປນ** — verify the Lao country name for Spain.
10. **atom → ປະລຳ** — Lao science register; the ອະຕອມ loanword is the
    alternative.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud
TTS, Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz. A Lao sentence
may surround them with spaces per orthography; code identifiers in the
PNP debugger body (`assessment`, `requiredTools`,
`updateAssessment(...)`) stay verbatim like every locale.

## Numbers, plurals, direction

- Arabic numerals everywhere; `{count}`, `{position}`, `{degrees}`
  render as digits, never Lao numerals.
- CLDR Lao has a single plural category, `other` (verified against
  `Intl.PluralRules("lo")`: `pluralCategories: ["other"]` for 0, 1, 2,
  5, 11, 21, 100). All six plural groups carry `other` only, with
  `{count}` inside it.
- Lao is LTR; nothing here overrides direction.

## A11y strings

Keys ending `A11y` are screen-reader operating instructions. Translate
them as complete, self-sufficient sentences — the learner hears them
without seeing the layout — and keep every keyboard instruction
concrete. Latin key names stay where Lao keyboards label them that
way: Shift, PageUp, PageDown, Escape, +/-, U.
