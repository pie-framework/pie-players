# Urdu (ur) brief

Serves every Urdu host: registered under the bare `ur` tag, so `ur`,
`ur-PK` and `ur-IN` all widen to it. Content flavour is Urdu in the formal
educational register of Pakistani assessment software.

## Register

- Controls carry the respectful imperative standard in Urdu UI: `بند کریں`
  (close), `منسوخ کریں` (cancel), `محفوظ کریں` (save), `جمع کریں`
  (submit — the exam-hall verb, not a mail-send loan), `مکمل کریں`
  (finish), `اگلا`/`پچھلا` (next/previous).
- Sentences address the learner respectfully in the second person where a
  possessive is unavoidable (`آپ کے محفوظ جواب`), otherwise impersonally.
- Vocabulary is Perso-Arabic first: نشست (session), واقعات (events), خام
  (raw), منقطع (disconnected), فراہم کنندہ (provider), میزبان (host) —
  never Hindi registers (`प्रश्न`-type calques have no place here).
- Distinct keys never collapse to one label: `common.retry` takes the
  nominal `دوبارہ کوشش` (the ar verbal-noun pattern) while the check
  button keeps the imperative `دوبارہ کوشش کریں`. Inside A11y
  instruction sentences, key names end mid-sentence with an Urdu clause
  where possible (`…PageUp یا PageDown کا استعمال کریں۔`), so no
  sentence ends on a bare Latin token. `debug.resume` is `دوبارہ جاری
  کریں`, distinct from `common.continue` = `جاری رکھیں`.
- Absorbed English nouns stay where Pakistani tech Urdu has no settled
  alternative and the word is universal: لوڈ، سکرول، پینل، ونڈو، ٹیب،
  بٹن، کنٹرول، براؤزر، سروس، بیک اینڈ، اوورلے، لینز، فریم، اسنیپ شاٹ،
  ڈیٹا، ڈی بی، سرور.
- Whole sentences authored whole; no fragment assembly.

## Terminology

| English | Urdu | Note |
| --- | --- | --- |
| question | سوال | questions = سوالات; learner-facing regions show سوالات |
| passage | متن | passages = متون |
| section | حصہ | sections = حصے |
| assessment | جانچ | the education-sector word, not تشخیص (diagnosis) |
| submit | جمع کریں | exam register |
| check answer | جواب جانچیں | جانچنا = to check/verify |
| try (check and retry) | کوشش | plural کوششیاں |
| settings | ترتیبات | matches configure = ترتیب دینا |
| tools | آلات | toolkit = آلات کا مجموعہ |
| calculator | حسابی مشین | بنیادی، سائنسی، گرافیکی |
| graph | گراف | absorbed; coordinate plane = مختصاتی مستوی |
| grid | شبکہ | |
| periodic table | دوری جدول | |
| atomic number / mass | جوہری عدد / جوہری کمیت | spelled out for screen readers |
| electron config | الیکٹرانی ترتیب | spelled out |
| ruler | پیمانہ | the measuring instrument, not the workshop گز |
| inches / centimeters | انچ / سینٹی میٹر | |
| unit | اکائی | math register |
| protractor | زاویہ پیما | parallels the -پیما instrument family |
| dictionary | قاموس | |
| entry (dictionary) | اندراج | plural اندراجات |
| picture dictionary | تصویری قاموس | |
| Spanish (language name) | ہسپانوی | `ہسپانوی قاموس` |
| line reader | سطر رہنما | سطر = line, رہنما = guide |
| magnifier | مکبّر | |
| zoom in / out | قریب کریں / دور کریں | camera convention |
| highlight(er) | نمایاں کاری / نمایاں کاری کا اوزار | |
| underline | نیچے لکیر | verb: لکیر کھینچیں |
| annotate | حاشیہ | حاشیہ لگائیں; annotation toolbar = حاشیہ نویسی کے اوزار |
| theme | تھیم | contrast = تضاد |
| text to speech | بلند خوانی | learner read-aloud phrasing |
| playback speed | بلند خوانی کی رفتار | |
| sign language | اشاروں کی زبان | |
| audio transcript | آڈیو کی نقل | |
| strike through | لکیر کشی | the answer-eliminator action; eliminated = کاٹا گیا |
| choice (answer) | انتخاب | |
| pixels | پکسل | singular after numerals (`{pixels} پکسل`) |
| degrees | درجہ | keep the `°` glyph |
| voice (TTS) | آواز | audio = آڈیو |
| provider | فراہم کنندہ | |
| teacher | استاد | agency: کے ذریعے (`استاد کے ذریعے نمبر دیا گیا`) |
| accommodation (PNP) | سہولت | |
| read-only | صرف پڑھنے کے لیے | |

Gender agreement follows the head noun, not the tool: حسابی مشین is
feminine (`کھل گئی`), اوزار masculine (`گھوم گیا`), انتخاب masculine
(`کاٹا گیا`).

## Selection announcements (annotation live region)

The eight keys added after `highlightGreenA11y` (`selectionAvailableA11y`,
`highlighted*A11y`, `underlinedA11y`, `removedA11y`, `clearedA11y`) pin:

- The term is quoted with the curly `“{text}”` — the lookup-notice glyph —
  and `{text}` stays inside the quotes in every key.
- The toolbar name reuses `toolbarA11y`'s compound حاشیہ نویسی کے اوزار;
  `selectionAvailableA11y` ends on an Urdu clause with Shift+F10 kept
  Latin (`…Shift+F10 دبائیں۔`), so no sentence ends on a bare Latin token.
- Event passives agree with the head noun, not the tool: متن masculine
  (`نمایاں کیا گیا`), لکیر feminine (`لکیر کھینچی گئی`), حاشیہ masculine
  (`ہٹا دیا گیا`). Colours ride the نمایاں کاری family in the
  `زرد رنگ میں نمایاں کیا گیا` shape.
- `clearedA11y` is the locale's `one`/`other` count group:
  `{count} حاشیہ صاف کیا گیا` / `{count} حاشیے صاف کیے گئے` (singular /
  plural noun, the 2–10 register). Western digits are n/a across these
  keys — the only numeral is the interpolated `{count}`.

## RTL conventions

- Urdu is RTL; `dir` comes from the provider (`localeDirection`), never
  from the catalog. The RTL layout contract itself is already audited (the
  framework's `ar` locale plus section-player's rtl-layout geometry spec),
  so strings carry no layout work — only in-string bidi rules below.
- Digits are Western (`latn`), pinned per the `ar` precedent: every literal
  digit in the catalog (`0`, `10`, `180`, `1` in `speedOptionsHelp`, the
  `8000 Hz` sample rates) is Western. Nastaliq is the display convention
  for Urdu prose but is a font concern no catalog string carries; UI digits
  stay Western. Interpolated numeric placeholder values render through
  `Intl.NumberFormat` at the resolved locale — CLDR resolves bare `ur` to
  Extended Arabic-Indic (`arabext`), so a host asking for `ur` gets those
  digits in interpolated counts unless it pins a form. Native review should
  confirm which form Pakistani assessments prefer for `{count}`.
- Punctuation glyphs: Urdu comma `،` in lists and clauses, Urdu semicolon
  `؛`, Urdu full stop `۔` at sentence ends. No string needs `؟` (the
  catalog holds no questions). The lookup notices take curly quotes
  `“{term}”`, modern Urdu print convention. The `…` ellipsis is kept, and
  `%` stays Latin beside the Western digits (`{percent}%`).
- Bidi in strings: a Latin token never stands immediately before terminal
  punctuation. Latin product names open sentences (`Web Speech API اس
  براؤزر میں…`) or sit mid-sentence with Urdu on both sides (`ترتیب دیے
  گئے API سے Google Cloud TTS دستیاب نہیں۔`); labels may end in a bare
  Latin token only when nothing follows (`…کا JSON`, `API کا اینڈ
  پوائنٹ`). The `{id}`, `'{id}'` and `({status})` interpolations keep the
  ar precedent's straight quotes and neutral clustering. No RLM/LRM
  control characters are embedded — data stays direction-agnostic.
- Key names stay Latin inside A11y sentences: Shift، PageUp، PageDown،
  Escape، +/-، U, joined with Urdu conjunctions (`وShift+تیر`,
  `باریک گھمانے کے لیے PageUp یا PageDown`).

## Untranslated product names

PIE, PNP, TTS (in genuinely technical strings only; learner-facing panels
say بلند خوانی), SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud
TTS, Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz, `/api/tts`,
`en-US`, and the record-kind/session-db identifier strings
(`instrumentationKind*`, `sessionDb*`), which every locale carries
verbatim.

## Plurals — two CLDR categories

`Intl.PluralRules("ur")` yields `one` (n = 1) and `other`. All six count
groups (`player.check.triesLeft`, `tools.dictionary.entriesCount`,
`tools.pictureDictionary.entriesCount`, `debug.tts.browserAvailable`,
`debug.tts.pollyAvailable`, `debug.tts.googleAvailable`) carry exactly
`one`/`other`, each category holding `{count}` (and `{engine}` on
`pollyAvailable`). The `other` noun takes the plural (کوششیاں، اندراجات،
تصاویر، آوازیں) — natural for the 2–10 counts these UIs announce;
measurement nouns stay singular after numerals (`{pixels} پکسل`).
