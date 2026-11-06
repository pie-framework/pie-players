# Russian (ru) brief

Serves every Russian host: the catalog is registered under the bare `ru` tag,
so `ru` and `ru-RU` widen to it. Register is the **school register of Russian
assessment software** — the word set of ЕГЭ/ОГЭ exam papers and of Russian
test platforms (Учи.ру, Яндекс.Учебник, Moodle-ru) — written for learners,
teachers and proctors. Slavic plural precedent is the Polish/Ukrainian pair:
every plural group carries one/few/many/other.

## Register

Per string class, because the nl-NL calibration showed one blunt rule fails:

- **Controls and a11y action labels carry the infinitive** — the default
  register of Russian software buttons: `Сохранить`, `Закрыть`,
  `Изменить размер панелей`, `Отцентрировать окно инструмента`. An
  imperative button (`Сохраните`) reads wrong to a Russian user.
- **Instruction sentences inside a11y prose keep the вы-imperative** without
  direct address — no `ты`, no `Вы` capitalized: `Перемещайте стрелками…`,
  `Ответьте на задание {position}, чтобы продолжить`. Russian вы-forms are
  register-neutral, which is the analogue of the Polish imperative rule.
- **Sentences prefer impersonal phrasing.** Failures take `Не удалось` +
  infinitive (`Не удалось загрузить задание.`), capability statements take
  `нельзя`/`невозможен` (`Пока эта служба недоступна, применить настройки
  нельзя.`). Possessives are dropped where grammar allows:
  `сохранённые ответы этого раздела`, never `ваши сохранённые ответы`.
- **State changes are announced as events, never as stative participles.**
  Two formulas, pinned per site:
  - *Noun events* for open/close: `Открытие обычного калькулятора`,
    `Закрытие графического калькулятора` — the French-precedent form;
    `Обычный калькулятор открыт` reads as a state and is rejected.
  - *Impersonal neuter short passives* for moves, rotations and switches:
    `Перемещено вверх в позицию {position}`, `Повернуто на {degrees}
    градусов`, `Переключено на {unit}`, `Перемотано вперёд`. The -о ending
    is genderless, so nothing genders the tool.
- **Loading states take the noun label** idiomatic in Russian software:
  `Загрузка…`, `Загрузка калькулятора…`. The `загрузка` family throughout;
  `погрузка` (cargo register) has no place here.
- **Outcome announcements read as adverbs:** `Верно.`, `Частично верно.`,
  `Неверно.`
- Whole sentences are authored whole; no fragment assembly.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any single
string's fidelity.

| English | Russian | Note |
| --- | --- | --- |
| question / items | задание / задания | the exam-paper word (ЕГЭ numbers задания); `вопрос` is one interrogative; `item` is psychometric jargon |
| passage | текст | `Прочитайте текст…` school phrasing |
| section | раздел | Russian tests have разделы; `секция` is a calque |
| assessment | тест | the delivered test; `экзамен` too specific, `оценивание` psychometric |
| submit | Отправить | the standard Russian UI verb; `Сдать` ambiguous (take/hand in) |
| finish | Завершить | |
| check answer | Проверить ответ | |
| try (noun) | попытка | `Осталась 1 попытка. / Остались 2 попытки. / Осталось 5 попыток.` |
| retry / try again | Повторить / Попробовать ещё раз | controls = infinitive; retry sentences end `Попробуйте ещё раз.` |
| loading… | Загрузка… | never `Погрузка…` |
| panel / resize | панель / изменить размер | controls: `Изменить размер…` |
| tools / toolbar | инструменты / панель инструментов | `инструменты теста` for assessment tools |
| toolkit (in prose) | набор инструментов | code identifiers (`assessment`, `updateAssessment(...)`, `requiredTools`) stay verbatim |
| calculator | Калькулятор | обычный / инженерный / графический — the Windows-ru register; `научный` rejected as a calque of *scientific* |
| graph | График | the school word; `граф` is graph theory |
| coordinate plane | координатная плоскость | the math-education term, verbatim from the textbook |
| grid | сетка | opacity = `прозрачность`, the Russian UI word |
| point | точка | |
| line (drawing mode) | Отрезок | two endpoints draw an отрезок, the school-geometry word; `линия` is the infinite line |
| selector mode | Выделение | action-name modes: Точка, Отрезок, Выделение, Удалить |
| delete | Удалить | |
| periodic table | Периодическая таблица | the compact school/encyclopedia form; `Периодическая система (химических элементов) им. Менделеева` is the fuller term, too long for a toolbar |
| element | элемент | |
| atomic number / atomic mass | порядковый номер / атомная масса | **порядковый номер** is the school-chemistry term Менделеев's table actually uses; `атомный номер` is a calque; both spelled out for screen readers |
| electron configuration | электронная конфигурация | |
| phase | агрегатное состояние | values Твёрдое / Жидкое / Газообразное — neuter adjectives agreeing with the elided `состояние` |
| element categories | щелочной металл, щёлочноземельный металл, переходный металл, постпереходный металл, полуметалл, двухатомный неметалл, многоатомный неметалл, инертный газ, лантаноид, актиноид | **полуметалл** and **инертный газ** are the school-textbook words over `металлоид`/`благородный газ` |
| ruler | Линейка | the school drawing instrument |
| inches / centimeters | Дюймы / Сантиметры | sentence forms `дюймы` / `сантиметры` |
| protractor | Транспортир | the only Russian school word for it |
| degrees | градусов | keep the `°` glyph |
| dictionary | Словарь | |
| entry (dictionary) | статья | the lexicographic term (словарная статья): `Нет статьи для «{term}».`, `{count} статей`; rejected `запись` (generic record) |
| picture dictionary | Картинный словарь | the established lexicographic genre; picture = `картинка` |
| line reader | Направляющая для чтения | the reading-guide overlay; reading window = `окно чтения`, frame = `рамка`; rejected `читалка` (app register) |
| magnifier | Лупа | zoom in/out = `Увеличить` / `Уменьшить`; lens = `линза` |
| highlight(er) | Выделение / Выделить | Microsoft Word-ru register; the pen reading `маркер` stays out |
| underline | Подчеркнуть | |
| annotate / annotation | Аннотировать / Аннотация | Edge/Word-ru PDF register |
| strike through | Зачеркнуть / зачёркивание | the exam-room action; eliminated choice appends `(зачёркнут)`, agreeing with `вариант` |
| choice (answer option) | вариант ответа | |
| clear all | Удалить все | |
| theme | Тема | never `тематика` |
| read aloud | читать вслух | tool name = `Чтение вслух` |
| playback speed | скорость чтения | |
| rewind / fast-forward | Перемотать назад / Перемотать вперёд | announcements: `Перемотано вперёд`, `Не удалось перемотать…` |
| preview (visual) | Предпросмотр | compound form, the VS Code/Chrome-ru register; never `Просмотр` (means view) |
| audio preview | прослушивание | `Прослушать голос`, `Остановить прослушивание` |
| sample (TTS text) | пример | `Пример текста` |
| voice (TTS) | голос | |
| engine (TTS) | движок | values `Нейронный` / `Стандартный` |
| sample rate | частота дискретизации | the Russian DSP term |
| speech marks | метки речи | |
| word tracking | отслеживание слов | |
| math highlighting | выделение формул | formula = `формула` |
| sign language | жестовый язык | the deaf-community and academic term over the calque `язык жестов`; Signed English = `жестовый английский`; language names lowercase mid-sentence (Russian orthography), so `regionA11y` builds `Перевод на {language}` |
| audio transcript | Транскрипция | |
| pixels | пиксель | counted only inside the `в пикселях` frame (below) |
| media (timed) | медиафайл | the naturalized Russian tech word |
| district (PNP) | округ | gloss of the US школьный округ |
| accommodation | аккомодация | the psychometric term in Russian assessment literature |
| provider | поставщик | |
| placement | размещение | |
| resolved | итоговый | `Итоговые инструменты` — resolved after policy application |
| session / snapshot | сеанс / снимок | debugger tables |
| event | событие | |
| controller / coordinator | контроллер / координатор | |
| instrumentation | инструментирование | the OpenTelemetry-ru word |
| payload | данные | `подробности его данных`; rejected the calque `полезная нагрузка` in learner chrome |
| environment | окружение | the Russian software word; `среда` is the habitat |
| canonical | каноническое | neuter, agreeing with the elided `значение` |
| enabled / disabled / off | Включено / Выключено / Выкл. | toggle states; `Выкл.`/`Вкл.` (pnp.on) are the Russian switch register |
| host (dev strings) | хост | naturalized Cyrillic tech loanword, kept in developer panels |
| n/a | н/д | |
| unknown (generic) | Неизвестно | impersonal; `Неизвестная` only where it agrees with `категория`; `Неизвестная ошибка` with `ошибка` |
| all / none | Все / Нет | `Нет` is the standard Russian filter/enum value |

## Grammar and agreement pins

- Every plural group carries the counted-noun form proper to its CLDR
  category: **one** = integers ending in 1 except the teens (1, 21, 101,
  1000001) → singular nominative with agreeing verb (`Осталась 1 попытка.`,
  `обнаружен 1 голос`), **few** = integers ending in 2–4 except the teens
  (2–4, 22–24, 32–34) → plural nominative (`Остались 2 попытки.`,
  `обнаружено 2 голоса`), **many** = everything else integer (0, 5–9,
  11–20, 25, 100) → genitive plural (`Осталось 5 попыток.`,
  `обнаружено 5 голосов`), **other** = fractions (1,5 — comma decimal
  separator) → genitive singular (`Осталось 1,5 попытки.`). Numeral rules
  verified against sampled `Intl.PluralRules("ru")` output: 1/21/101 → one,
  2/3/22 → few, 0/5/11/100/1000000 → many, 1.5 → other.
- Verb agreement: one takes the agreeing past (`Осталась`, `обнаружен`,
  `найден`); every other category takes the impersonal neuter (`Осталось`,
  `обнаружено`, `найдено`) — the standard Russian UI register with numeral
  subjects (`Найдено 2 файла`).
- Inline counts against interpolated numbers avoid agreement entirely by
  framing `в` + prepositional: `Высота окна чтения в пикселях: {pixels}`,
  `Текущий размер в пикселях: {width} × {height}`. Never `{n} пикселей`
  against an interpolated number, which breaks for 2–4.
- Genderless enums take the unmarked masculine: `any` = Любой; the TTS
  gender enums agree with `пол` (masculine): Любой / Мужской / Женский /
  Нейтральный. Where a form agrees with a fixed grammatical subject it
  follows that subject: `(зачёркнут)` with `вариант`; `недоступна` with
  `тема` (`{name}, недоступна`); `локальный`/`удалённый` with the elided
  `голос`; theme-selector and category values follow their nouns.
- Sentence-internal field labels stay lowercase: `{name}, символ: {symbol},
  порядковый номер: {number}, атомная масса: {mass}, категория:
  {category}`. Element category and phase enum values stay capitalized as
  list entries.
- Sizes join with the multiplication sign: `{width} × {height}`.
- `Graph point {id}` renders without the tool name: `Точка {id}`,
  following the audited Dutch de-duplication.
- Google Cloud TTS / AWS Polly availability sentences name the service
  explicitly to fix agreement: `Сервис Google Cloud TTS недоступен…`,
  `Сервис AWS Polly доступен (найден…)`; Web Speech API takes the neuter
  (`Web Speech API недоступно`), as does `API`.

## Case and preposition pin (ruler units)

The ruler's unit words serve three interpolation frames. Nominative and
accusative are identical (`дюймы`, `сантиметры`), which the catalog
exploits: `switchedTo` takes `Переключено на {unit}` (на + accusative),
`applicationA11y` takes `Текущая единица: {unit}` (nominative). The image
alt avoids the prepositional that would break the shared form — `Линейка со
шкалой: {unit}`, not `…в дюймах`. No second word form is introduced, because
the key set carries only `inchesInSentence`/`centimetersInSentence`.

## Punctuation and glyphs

- Quotes are the Russian «ёлочки», including around an interpolated term:
  `Поиск «{term}»…`, `Нет статьи для «{term}».` — never English curly
  quotes. The dev-panel single quotes around `'{id}'` stay verbatim from
  the source.
- The ellipsis is …; degrees keep °; sizes join with ×.
- Control labels and enum values are sentence-case; sentence-internal
  labels lowercase (above).

## Selection announcements (annotation live region)

The eight annotation-strip live-region keys (`selectionAvailableA11y`,
`highlightedYellow/Pink/Blue/GreenA11y`, `underlinedA11y`, `removedA11y`,
`clearedA11y`) are announced, never rendered. Sentence shapes, pinned so
regeneration reproduces them:

- `selectionAvailableA11y` — the full two-sentence availability message:
  `Доступна панель аннотирования для «{text}». Нажмите Shift+F10, чтобы
  открыть инструменты аннотирования.` (вы-imperative, Latin `Shift+F10`).
- `highlightedYellow/Pink/Blue/GreenA11y` — impersonal neuter short-passive
  events in the instrumental, colors from the `Жёлтое/Розовое/Синее/Зелёное
  выделение` family: `«{text}» выделено жёлтым` (розовым/синим/зелёным
  likewise). The -о ending genders nothing — the event rule above.
- `underlinedA11y` — same frame: `«{text}» подчёркнуто`.
- `removedA11y` — named subject with perfective passive, the
  `Ответ зафиксирован` family: `Аннотация удалена из «{text}»`.
- `clearedA11y` — plural group with the `browserAvailable` verb-agreement
  pattern: **one** `Удалена {count} аннотация`, **few** `Удалено {count}
  аннотации`, **many** `Удалено {count} аннотаций`, **other** `Удалено
  {count} аннотации`.
- The quoted selection takes «ёлочки» per the punctuation rule above.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, **Hz** (the sample-rate
values keep the Latin symbol; `Гц` stays out); code identifiers in the PNP
prose (`assessment`, `updateAssessment(...)`, `requiredTools`);
instrumentation record kinds and session-db field names
(`all`/`event`/`error`/`metric`/`user-context`/`global-attributes`,
`assessmentId:`, `sectionId:`, `attemptId:`, `mode:`); the SSML tag named in
prose (`emphasis`); the `/api/tts` and `en-US` placeholders.

## Plurals — the four categories

CLDR Russian: **one** = integers with `i % 10` = 1 and `i % 100` ≠ 11 (1,
21, 31, 101, 1000001); **few** = integers with `i % 10` in 2–4 and
`i % 100` not in 12–14 (2–4, 22–24, 102…); **many** = all other integers
(0, 5–9, 10–20, 100, 1000000); **other** = fractions (1,5). Every group
carries all four, each with `{count}`:

- `player.check.triesLeft`: `Осталась {count} попытка.` / `Остались
  {count} попытки.` / `Осталось {count} попыток.` / `Осталось {count}
  попытки.`
- `tools.dictionary.entriesCount`: `{count} статья` / `{count} статьи` /
  `{count} статей` / `{count} статьи`
- `tools.pictureDictionary.entriesCount`: `{count} картинка` / `{count}
  картинки` / `{count} картинок` / `{count} картинки`
- `debug.tts.browserAvailable`: `(обнаружен {count} голос)` / `…обнаружено
  {count} голоса)` / `…обнаружено {count} голосов)` / `…обнаружено {count}
  голоса)`
- `debug.tts.pollyAvailable`: `(найден {count} подходящий голос, движок
  {engine})` / `…найдено {count} подходящих голоса…` / `…найдено {count}
  подходящих голосов…` / `…найдено {count} подходящего голоса…`
- `debug.tts.googleAvailable`: `(найден {count} подходящий голос)` /
  `…найдено {count} подходящих голоса)` / `…найдено {count} подходящих
  голосов)` / `…найдено {count} подходящего голоса)`

Note the adjective in the Polly/Google groups: 2–4 masculine takes
`подходящих` (genitive-plural agreement after `два/три/четыре`), 5+ takes
`подходящих` (genitive plural), one takes `подходящий`, fractions take
`подходящего`.

## A11y strings

Keys ending `A11y` are complete, self-sufficient screen-reader sentences —
the learner hears them without seeing the layout — and every keyboard
instruction stays concrete. Latin key names stay Latin, as Russian keyboards
print them: Shift, PageUp, PageDown, Escape, +/-, U. Ruler units are spelled
out in full in a11y prose for the same reason English spells them: a screen
reader says `см` as two letters. Tool names inside a11y prose take «ёлочки»:
`Инструмент «Линейка»…`.
