# Persian (fa) brief

Serves every Persian host: registered under the bare `fa` tag, so `fa` and
`fa-IR` widen to it (`fa-AF` widens here too; its content is the Iranian
register — a Dari-flavoured host overrides per key through
`customMessages`). Content flavour is formal written Persian in the
educational register.

## Register

- Controls carry the مصدر/noun-phrase forms standard in Persian UI:
  `بستن` (close), `لغو` (cancel), `ذخیره` (save), `بازنشانی` (reset),
  `تحویل` (submit — the exam-delivery word, not the mail-send `ارسال`),
  `پایان` (finish), `بعدی`/`قبلی` (next/previous), `نمایش` (show),
  `تغییر اندازه` (resize).
- Sentences use formal written Persian with the polite imperative
  (`کنید` forms): `دوباره تلاش کنید`, `به پرسش {position} پاسخ دهید`.
- State changes are announced as events, never stative participles:
  `ماشین‌حساب ساده باز شد`, `پخش متوقف شد`, `به {unit} تغییر یافت` —
  the fr/pt event-noun precedent.
- Vocabulary is Persian-first: واژه (word), پرسش (question), بخش
  (section), پیکربندی (configure), فراهم‌کننده (provider), پایگاه داده
  (database), نمایه (profile), مرورگر (browser), زبانه (tab), یکا (unit).
  Absorbed loans stay where universal: پنل، پنجره، موتور، بک‌اند،
  بلوک، برچسب، دکمه، رکورد.
- Distinct keys never collapse to one label: the annotation toolbar's
  read-aloud button is `خواندن با صدای بلند`, keeping it distinct from
  the TTS tool name `بلندخوانی`; the annotation tooltip is
  `حاشیه‌نویسی متن` against the tool name `حاشیه‌نویسی`; and
  `debug.resume` is `از سرگیری`, distinct from `common.continue` =
  `ادامه`; and the annotation toolbar's remove is `برداشتن`, distinct
  from the graph tool's delete mode `حذف` — two labels reading the same
  is a defect, not a style choice.
- Whole sentences authored whole; no fragment assembly.

## ZWNJ half-space rules

Every required half-space (U+200C) is present, consistently:

- Verb prefixes: می‌شود، نمی‌پذیرند، می‌ماند؛ negation نمی‌ same.
- به‌/نا- clitics: به‌صورت، به‌جای، به‌روزرسانی، به‌روزرسانی‌ها؛
  نامطمئن‌بودن، فقط‌خواندنی.
- Compound nouns: واژه‌نامه، ماشین‌حساب، خط‌کش، ذره‌بین، راه‌اندازی،
  جابه‌جایی، جهت‌نما، بزرگ‌نمایی، کوچک‌نمایی، اندازه‌گیری،
  حاشیه‌نویسی، برجسته‌سازی، گفتارسازی، زمان‌نشان، فراهم‌کننده،
  هماهنگ‌کننده، جای‌گذاری، نقطه‌ویرگول، چپ‌چین، درون‌خطی، هم‌تراز،
  پس‌واسطه، شبه‌فلز، نیم‌دایره‌ای، سانتی‌متر.
- Plural marker and ezafe-ی: پرسش‌ها، متن‌ها، داده‌های، ضریب‌های،
  نشان‌های گفتار.
- Ezafe is written with hamze-on-he (ٔ) after ه-final words (پنجرهٔ
  ابزار، صفحهٔ مختصات، همهٔ عناصر) and left unmarked after
  consonant-final words (خطای پیکربندی، عرض متن), Persian
  Wikipedia/tech norm.
- غیرفعال is one word, no half-space.

## Terminology

| English | Persian | Note |
| --- | --- | --- |
| question | پرسش | questions = پرسش‌ها; not the Arabic loan سؤال |
| passage | متن | passages = متن‌ها |
| section | بخش | |
| assessment / test | آزمون | |
| submit | تحویل | exam-delivery register |
| check answer | بررسی پاسخ | |
| try (formative) | فرصت | a remaining chance |
| settings | تنظیمات | |
| tools | ابزارها | toolkit = مجموعه ابزارها |
| calculator | ماشین‌حساب | ساده، علمی، نموداری |
| graph | نمودار | coordinate plane = صفحهٔ مختصات |
| grid | شبکه | |
| periodic table | جدول تناوبی | |
| atomic number / mass | عدد اتمی / جرم اتمی | spelled out for screen readers |
| electron config | آرایش الکترونی | the chemistry term, spelled out |
| ruler | خط‌کش | |
| inches / centimeters | اینچ / سانتی‌متر | |
| unit | یکا | the metrology term |
| protractor | نقاله | |
| dictionary | واژه‌نامه | |
| entry (dictionary) | مدخل | lexicography term |
| picture dictionary | واژه‌نامه تصویری | |
| Spanish (language name) | اسپانیایی | `واژه‌نامه اسپانیایی` |
| line reader | راهنمای خواندن | reading-guide tool |
| magnifier | ذره‌بین | magnification = بزرگ‌نمایی |
| zoom in / out | بزرگ‌نمایی / کوچک‌نمایی | |
| highlight(er) | برجسته‌سازی / برجسته‌ساز | |
| underline | زیرخط | |
| annotate | حاشیه‌نویسی | |
| theme | پوسته | contrast = کنتراست |
| text to speech | بلندخوانی | learner read-aloud phrasing; technical strings may say تبدیل متن به گفتار |
| playback speed | سرعت خواندن | |
| sign language | زبان اشاره | |
| audio transcript | رونوشت صوتی | |
| strike through | خط زدن | choice = گزینه; eliminated = خط خورده (agrees with گزینه) |
| pixels | پیکسل | |
| degrees | درجه | keep the `°` glyph |
| voice (TTS) | صدا | audio = صوت |
| provider | فراهم‌کننده | |
| teacher | معلم | agency: توسط (`نمره‌دهی توسط معلم`) |
| accommodation (PNP) | تسهیلات | |
| read-only | فقط‌خواندنی | |
| coordinator | هماهنگ‌کننده | |
| debugger | اشکال‌زدا | |
| snapshot | تصویر لحظه‌ای | |

## Selection announcements (annotation live region)

The eight keys added after `highlightGreenA11y` (`selectionAvailableA11y`,
`highlighted*A11y`, `underlinedA11y`, `removedA11y`, `clearedA11y`) pin:

- The term rides the guillemets `«{text}»` — the Persian lookup-notice
  glyph — and `{text}` stays inside them in every key.
- ZWNJ orthography holds (حاشیه‌نویسی، زیرخط‌دار): `زیرخط‌دار شد`.
- Events, never participles, in the `به رنگ + colour برجسته شد` shape;
  Persian colour adjectives are invariant, so the en-US comment's
  colour-agreement concern does not bite. `removedA11y` reuses the
  برداشتن pin: `حاشیه‌نویسی «{text}» برداشته شد`.
- `selectionAvailableA11y` closes with the polite imperative
  (`Shift+F10 را فشار دهید`).
- `clearedA11y` is the `one`/`other` group with both categories
  identical — `{count} حاشیه‌نویسی پاک شد` — the documented Persian noun
  invariance, not an omission.

## RTL conventions

- Persian is RTL; `dir` comes from the provider (`localeDirection`),
  never from the catalog. The RTL layout contract is already audited (the
  framework's `ar` locale plus section-player's rtl-layout geometry
  spec), so strings carry no layout work — only in-string bidi rules.
- Digits are Western (`latn`), pinned per the `ar` precedent: every
  literal digit (`0`, `10`, `180`, the `1` in `speedOptionsHelp`, the
  `8000 Hz` sample rates) is Western, and `%` stays Latin beside them
  (`{percent}%`). Persian typographic digits (۰–۹, `arabext`) are the
  CLDR default for interpolated values: the engine renders numeric
  placeholder values through `Intl.NumberFormat` at the resolved locale,
  and bare `fa` resolves to `arabext`, so a host asking for `fa` gets
  Persian digits in interpolated counts. Native review should confirm
  which form Iranian assessments prefer for `{count}`.
- Punctuation glyphs: Persian comma `،`, Persian semicolon `؛`, Latin
  full stop `.` (standard Persian sentence punctuation). No string needs
  `؟`. The lookup notices take guillemets `«{term}»` — the standard
  Persian quotation marks, matching the ar precedent. The `…` ellipsis
  is kept.
- Bidi in strings: a Latin token never stands immediately before
  terminal punctuation. Latin product names open sentences
  (`Web Speech API در این مرورگر در دسترس نیست.`) or sit mid-sentence
  with Persian on both sides (`Google Cloud TTS از API پیکربندی‌شده در
  دسترس نیست.`); labels may end in a bare Latin token only when nothing
  follows (`نقطهٔ پایانی API`, `JSON داده‌های نشست`). The `'{id}'` and
  `({status})` interpolations keep the ar precedent's straight quotes
  and neutral clustering. No RLM/LRM control characters are embedded.
- Key names stay Latin inside A11y sentences: Shift، PageUp، PageDown،
  Escape، +/-، U (`از Shift+کلیدهای جهت‌نما`, `با U یکا عوض می‌شود`).

## Untranslated product names

PIE, PNP, TTS (in genuinely technical strings only; learner-facing panels
say بلندخوانی), SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud
TTS, Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz, `/api/tts`,
`en-US`, and the record-kind/session-db identifier strings
(`instrumentationKind*`, `sessionDb*`), verbatim across locales.

## Plurals — two CLDR categories

`Intl.PluralRules("fa")` yields `one` (n = 0 or 1 — Persian zero takes
the singular form) and `other`. All six count groups
(`player.formative.triesLeft`, `tools.dictionary.entriesCount`,
`tools.pictureDictionary.entriesCount`, `debug.tts.browserAvailable`,
`debug.tts.pollyAvailable`, `debug.tts.googleAvailable`) carry exactly
`one`/`other`, each category holding `{count}` (and `{engine}` on
`pollyAvailable`). Persian nouns do not inflect for counted number
(`{count} فرصت`, `{count} مدخل`, `{count} صدا`), so the two categories
may carry identical text — deliberate, not an omission.
