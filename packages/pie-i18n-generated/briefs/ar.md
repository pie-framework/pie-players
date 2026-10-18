# Arabic (ar) brief

Serves every Arabic host: registered under the bare `ar` tag, so `ar`,
`ar-SA`, `ar-AE` and `ar-EG` all widen to it. Content flavour is Modern
Standard Arabic in the formal educational register.

## Register

- Controls carry the verbal-noun forms standard in Arabic UI: `إغلاق`
  (close), `إلغاء` (cancel), `حفظ` (save), `إرسال` (submit), `إنهاء`
  (finish), `التالي`/`السابق` (next/previous).
- Sentences use MSA with the learner addressed impersonally or in the
  second person where a possessive is unavoidable (`محاولاتك`).
- Whole sentences authored whole; no fragment assembly.

## Terminology

| English | Arabic | Note |
| --- | --- | --- |
| question | سؤال | questions = أسئلة |
| items | الأسئلة | learner-facing regions show questions |
| passage | نص | passages = نصوص |
| section | قسم | |
| submit | إرسال | |
| finish | إنهاء | |
| check answer | التحقق من الإجابة | |
| settings | الإعدادات | |
| tools / toolbar | الأدوات / شريط الأدوات | |
| calculator | الآلة الحاسبة | أساسية، علمية، بيانية |
| graph | الرسم البياني | |
| coordinate plane | المستوى الإحداثي | |
| grid | الشبكة | |
| periodic table | الجدول الدوري | |
| atomic number | العدد الذري | spelled out for screen readers |
| ruler | المسطرة | |
| inches / centimeters | بوصة / سنتيمتر | |
| protractor | المنقلة | |
| dictionary | القاموس | |
| picture dictionary | القاموس المصور | |
| entry (dictionary) | مُدخل | |
| Spanish (language name) | الإسبانية | `القاموس الإسباني` |
| line reader | مساعد القراءة | |
| magnifier | المكبّر | |
| zoom in / out | تكبير / تصغير | |
| highlight(er) | تظليل / أداة التظليل | |
| underline | تسطير | |
| annotate | تعليق توضيحي | |
| theme | المظهر | |
| text to speech | القراءة الصوتية | read-aloud phrasing |
| playback speed | سرعة القراءة | |
| sign language | لغة الإشارة | |
| audio transcript | التفريغ النصي | |
| strike through | شطب | the answer-eliminator action |
| pixels | بكسل | |
| degrees | درجة | keep the `°` glyph |
| voice (TTS) | صوت | |

## Plurals — six CLDR categories

Arabic requires all six: `zero`, `one`, `two`, `few`, `many`, `other`.
Every category carries the `{count}` placeholder so the interpolation
contract stays identical across locales; `one` and `two` additionally
spell the number word (`مُدخل واحد`, `مُدخلان`).

## Direction, digits, punctuation

- Arabic is RTL; `dir` comes from the provider (`localeDirection`), never
  from the catalog. Data is direction-agnostic.
- Digits follow CLDR locale defaults: the engine renders numeric
  placeholder values through `Intl.NumberFormat` at the active locale, so
  `ar` renders Arabic-Indic digits and an `ar-MA` host renders Western
  ones. Catalog text carries no hard-coded numerals. Native review should
  confirm whether Gulf assessments prefer Arabic-Indic or Western digits
  for `{count}`; a host can pin either through `customMessages`.
- Arabic comma `،` in lists, `؟` is not needed in this catalog, guillemets
  `«{term}»` for the lookup notices, `…` kept.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API.
