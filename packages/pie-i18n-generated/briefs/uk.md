# Ukrainian (uk) brief

Serves every Ukrainian host: the catalog is registered under the bare `uk`
tag, so `uk` and `uk-UA` widen to it. Register is the standard Ukrainian of
Ukrainian schools and assessment software — the register of NMT test
delivery — written for learners, teachers and proctors.

## Register

Per string class, because the nl-NL calibration showed one blunt rule fails:

- Control labels carry the **infinitive** — the default register of
  Ukrainian software buttons: `Закрити`, `Зберегти`, `Перевірити
  відповідь`, `Змінити розмір панелей`, `Звузити вікно інструмента`.
- Instruction sentences inside a11y prose use the **polite plural
  imperative**, Ukrainian software's standard address:
  `Використовуйте стрілки…`, `Виберіть тему…`, `Перетягніть, щоб змінити
  розмір…`, `Дайте відповідь на завдання {position}, щоб продовжити`.
- Sentences prefer **impersonal phrasing**: failures take `Не вдалося` +
  past verb (`Не вдалося завантажити завдання.`), absences take `Немає…`
  (`Немає статті для {term}.`). Possessives are dropped:
  `збережені відповіді цього розділу`, never `ваші збережені відповіді`.
- **State changes are announced as impersonal `-но`/`-то` events**, never
  as stative participles that gender the tool: `Відкрито звичайний
  калькулятор`, `Закрито науковий калькулятор`, `Перемкнено на {unit}`,
  `Переміщено вгору до позиції {position}`, `Повернуто до {degrees}
  градусів`, `Відповідь прийнято`, `Читання призупинено`.
  `Звичайний калькулятор відкритий` reads as a state and is rejected.
- Progress/loading states take **noun labels** the way Ukrainian software
  prints them: `Завантаження…`, `Пошук «{term}»…`, `Початок читання`.
- Descriptions are **noun or verbal-noun phrases**: `Пошук визначень
  слів`, `Екранна лінійка для вимірювань`, `Збільшення вмісту під рухомою
  лінзою`.
- Outcome announcements read as adverbs: `Правильно.`, `Частково
  правильно.`, `Неправильно.`
- Whole sentences are authored whole; no fragment assembly.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any single
string's fidelity.

| English | Ukrainian | Note |
| --- | --- | --- |
| question / items | завдання / завдання | the NMT word; `запитання` is one interrogative; `item` is psychometric jargon. The noun is indeclinable neuter, so singular and plural share the form |
| passage | текст | `Прочитай текст…` school phrasing |
| section | розділ | Ukrainian tests have розділи; `секція` is a calque |
| assessment | тест | the delivered test; `оцінювання` stays out of chrome |
| submit | Здати | the hand-in verb (the analogue of Spanish `Entregar`); rejected `Надіслати` (send-register) |
| finish | Завершити | |
| check answer | Перевірити відповідь | |
| try (noun) | спроба | `Залишилася 1 спроба. / Залишилося 2 спроби. / Залишилося 5 спроб.` |
| retry / try again | Повторити / Спробувати ще раз | |
| loading… | Завантаження… | |
| panel / resize | панель / зміна розміру | controls: `Змінити розмір…` |
| tools / toolbar | інструменти / панель інструментів | |
| toolkit (in prose) | набір інструментів | code identifiers (`assessment`, `updateAssessment(...)`, `requiredTools`) stay verbatim |
| calculator | Калькулятор | звичайний, науковий, графічний — the Windows-UA mode names |
| graph | Графік | |
| coordinate plane | координатна площина | the textbook word; canvas = `полотно` |
| grid | сітка | opacity = `непрозорість` |
| point | точка | |
| line (drawing mode) | Відрізок | two endpoints draw a відрізок (segment), the school-geometry word; `лінія`/`пряма` is the infinite line |
| selector mode | Вибір | action-name modes: Точка, Відрізок, Вибір, Видалити |
| delete | Видалити | distinct from remove: `Вилучити`, the Microsoft-UA pair |
| remove | Вилучити | for the annotation remove action |
| periodic table | Періодична система | the school chemistry name (`Періодична система хімічних елементів`) |
| element | елемент | the chemistry word |
| atomic number / atomic mass | Порядковий номер / Атомна маса | the textbook term is `порядковий номер`; `атомний номер` rejected; spelled out for screen readers |
| electron configuration | електронна конфігурація | |
| phase | агрегатний стан | values Твердий / Рідкий / Газоподібный — adjectives agreeing with `стан` |
| element categories | лужний метал, лужноземельний метал, перехідний метал, постперехідний метал, напівметал, двоатомний неметал, багатоатомний неметал, інертний газ, лантаноїд, актиноїд | `напівметал` is the school word over `металоїд`; `інертний газ` the school word over `благородний газ` |
| ruler | Лінійка | |
| inches / centimeters | Дюйми / Сантиметри | sentence forms `дюйми` / `сантиметри` |
| protractor | Транспортир | the school instrument |
| degrees | градуси | keep the `°` glyph |
| dictionary | Словник | |
| entry (dictionary) | стаття | `словникова стаття`, the lexicographic term: `Немає статті для «{term}».`, `{count} статей`; rejected `запис` as generic |
| picture dictionary | Картинний словник | |
| picture | картинка | |
| line reader | Накладка для читання | the reading-guide overlay; reading window = `вікно читання`, frame = `рамка` |
| resizable | яку можна масштабувати | the compact relative clause used in role labels |
| magnifier | Лупа | zoom in/out = `Збільшити` / `Зменшити`; lens = `лінза` |
| highlight(er) | Виділення / Виділити | the Microsoft-UA choice; Ukrainian uses `виділення` for both selection and colour highlight — the swatch labels (`Жовте виділення`) disambiguate |
| underline | Підкреслити / підкреслення | |
| annotate / annotation | Анотація / анотування | mark up = `розмічування` |
| strike through | Закреслити / закреслення | the answer-eliminator action; `перекреслити` carries a negate meaning and is rejected |
| choice (answer option) | варіант відповідей | |
| clear all | Очистити все | |
| theme | Тема | contrast = `контрастність` |
| read aloud | читати вголос | tool name = `Читання вголос` |
| playback speed | швидкість читання | |
| rewind / fast-forward | Перемотати назад / Перемотати вперед | |
| preview (visual) | Перегляд | audio preview is a different word: `прослуховування` |
| audio preview | прослуховування | `Прослухати голос`, `Зупинити прослуховування` |
| sample (TTS text) | зразок | `зразок тексту` |
| voice (TTS) | голос | |
| engine (TTS) | рушій | values `Нейронний` / `Стандартний` |
| sample rate | частота дискретизації | the Ukrainian DSP term |
| speech marks | мовні мітки | |
| word tracking | відстеження слів | |
| math highlighting | виділення формул | formula = `формула` |
| sign language | жестова мова | Signed English = `Жестова англійська` |
| audio transcript | Транскрипція аудіо | |
| content | вміст | the standard Ukrainian software word; `контент` is informal |
| pixels | піксель | counted inline only inside the `в пікселях` frame (below) |
| media (timed) | медіа | indeclinable neuter |
| district (PNP) | округ | generic gloss of the US concept |
| accommodation | адаптація | the Ukrainian inclusion-education word |
| provider | постачальник | the Microsoft-UA term, over the colloquial `провайдер` |
| placement | розміщення | |
| session / snapshot | сеанс / знімок | the Microsoft-UA session word, not the tech-slang `сесія`; debugger tables |
| event | подія | |
| controller / coordinator | контролер / координатор | |
| instrumentation | інструментування | |
| error | помилка | |
| payload | дані | `подробиці її даних`; the calque `корисне навантаження` rejected |
| default | типовий | the standard Ukrainian software word; `типовий браузера` agrees with elided `голос` |
| host (dev strings) | хост | kept Latin-derived in developer panels |
| n/a | н/д | |

## Grammar and agreement pins

- Every plural group carries the counted-noun form proper to its CLDR
  category: **one** (integers ending in 1 except 11: 1, 21, 31, 101) →
  singular nominative with feminine verb agreement in `triesLeft`
  (`Залишилася 21 спроба.`); **few** (2–4 excluding 12–14) → plural
  nominative (`Залишилося 2 спроби.`); **many** (0, 5–9, 11–14, endings 0:
  10, 100, 1000) → genitive plural (`Залишилося 5 спроб.`); **other**
  (fractions) → genitive singular (`Залишилося 1,5 спроби.`).
- Do not copy forms across the Polish/uk pair: the languages split at 21 —
  Polish puts 21 in `many` (21 prób), Ukrainian puts it in `one`
  (21 спроба). Each catalog follows its own CLDR rule.
- Inline counts against interpolated numbers avoid agreement entirely by
  framing `в` + locative: `Висота вікна читання в пікселях: {pixels}`,
  `Поточний розмір у пікселях: {width} × {height}`. Never `{n} пікселі`
  against an interpolated number, which breaks for 2–4.
- The zoom announcement avoids the `раз/рази/разів` agreement trap:
  `Збільшення змінено: {zoom}×`. (Polish can keep `{zoom} razy`, because
  `razy` serves every count above 1; Ukrainian cannot.)
- Genderless enums take the unmarked masculine: `any` = Будь-який,
  `unknown` = Невідомий. Where a form agrees with a fixed grammatical
  subject it follows that subject: `(закреслена)` with `відповідь`;
  `Будь-яка/Чоловіча/Жіноча/Нейтральна` with `стать`; theme-selector
  unavailable values agree with `тема` (`{name}, недоступна`);
  `локальний`/`віддалений`/`типовий браузера` with elided `голос`;
  `Читання вголос…доступне` neuter with `читання`; `Служба AWS Polly
  недоступна` feminine with `служба`.
- Product-name gender: `Web Speech API` is masculine (`недоступний`, after
  `інтерфейс`); `читання`, `прослуховування` neuter; cloud services are
  phrased with `служба` to carry a fixed feminine.
- Sentence-internal field labels stay lowercase: `{name}, символ: {symbol},
  порядковий номер: {number}, атомна маса: {mass}, категорія: {category}`.
  Element category and phase enum values stay capitalized as list entries.
- Sizes join with the multiplication sign: `{width} × {height}`.
- `Graph point {id}` renders without the tool name: `Точка {id}`, following
  the audited Dutch de-duplication.

## Orthography and euphony pins

- Apostrophes where the standard requires them: `пов'язані`,
  `з'являтимуться`, `від'єднано`, `прив'язано`.
- Preposition euphony: `із` before к/п/т/ф/х and before digits —
  `Завдання {position} із {total}`; `у/в` per the standard —
  `у браузері`, `в пікселях`, `в обох напрямках`, `із завданням`.
- Quotes are « », the ellipsis is …, degrees keep °. The em dash in a11y
  prose takes spaces on both sides (`Інструмент графіка — додавайте
  точки…`).
- Enum values and control labels are sentence-case; sentence-internal
  labels lowercase (above).

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz; code identifiers in the
PNP prose (`assessment`, `updateAssessment(...)`, `requiredTools`);
instrumentation record kinds and session-db field names
(`all`/`event`/`error`/`metric`/`user-context`/`global-attributes`,
`assessmentId:`, `sectionId:`, `attemptId:`, `mode:`); the SSML tag named
in prose (`emphasis`).

## Plurals — the four categories

CLDR Ukrainian: **one** = integers ending in 1 except 11 (1, 21, 31, 41,
101…); **few** = integers with `i % 10` in 2–4 excluding `i % 100` 12–14
(2–4, 22–24, 32–34, 102…); **many** = integers ending in 0, 5–9, and the
teens 11–14 (0, 5, 10, 11, 12, 20, 100, 1000); **other** = fractions
(1,5 — comma decimal separator). `Intl.PluralRules("uk")` resolves exactly
these four categories, and every group carries all four, each with
`{count}`:

- `player.check.triesLeft`: `Залишилася {count} спроба.` / `Залишилося
  {count} спроби.` / `Залишилося {count} спроб.` / `Залишилося {count}
  спроби.`
- `tools.dictionary.entriesCount`: `{count} стаття` / `{count} статті` /
  `{count} статей` / `{count} статті`
- `tools.pictureDictionary.entriesCount`: `{count} картинка` / `{count}
  картинки` / `{count} картинок` / `{count} картинки`
- `debug.tts.browserAvailable`: `(виявлено {count} голос)` / `…голоси)` /
  `…голосів)` / `…голоса)` — `виявлено` takes the accusative, which for
  masculine inanimate equals the nominative at 1 and 2–4; fractions take
  the genitive singular
- `debug.tts.pollyAvailable`: `(знайдено {count} відповідний голос, рушій
  {engine})` / `…відповідні голоси…` / `…відповідних голосів…` /
  `…відповідного голоса…`
- `debug.tts.googleAvailable`: `(знайдено {count} відповідний голос)` /
  `…відповідні голоси)` / `…відповідних голосів)` / `…відповідного
  голоса)`

## A11y strings

Keys ending `A11y` are complete, self-sufficient screen-reader sentences —
the learner hears them without seeing the layout — and every keyboard
instruction stays concrete. Latin key names stay Latin, as Ukrainian
keyboards print them: Shift, PageUp, PageDown, Escape, +/-, U. Ruler units
are spelled out in full in a11y prose for the same reason English spells
them: a screen reader says `см`-style abbreviations as letters.
