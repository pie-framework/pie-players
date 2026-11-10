# Polish (pl) brief

Serves every Polish host: the catalog is registered under the bare `pl` tag,
so `pl` and `pl-PL` widen to it. Register is the formal-neutral Polish of
Polish schools and assessment software — the register of the arkusz
egzaminacyjny (exam paper) and of Polish test platforms — written for
learners, teachers and proctors.

## Register

Per string class, because the nl-NL calibration showed one blunt rule fails:

- Controls and a11y action labels carry the **2nd-person imperative** — the
  default register of Polish software buttons: `Zapisz`, `Sprawdź
  odpowiedź`, `Zmień rozmiar paneli`, `Wyśrodkuj okno narzędzia`. Polish UI
  does not use the infinitive for controls the way Spanish or Ukrainian
  does; an infinitive button (`Zapisać`) reads wrong to a Polish user.
- Instruction sentences inside a11y prose keep the imperative but **drop
  direct address**: no `twój/twoje`, no `Pan/Pani`
  (`Użyj strzałek do przesuwania…`, `Odpowiedz na zadanie {position}, aby
  kontynuować`).
- Sentences prefer **impersonal phrasing**. Failures take `Nie udało się` +
  infinitive (`Nie udało się wczytać zadania.`); capability statements take
  `Nie można…` (`Nie można zastosować ustawień…`). Possessives are dropped:
  `zapisanych odpowiedzi tej części`, never `twoich zapisanych odpowiedzi`.
- **State changes are announced as impersonal `-no/-to` events**, never as
  stative participles that gender the tool: `Otwarto kalkulator
  podstawowy`, `Zamknięto kalkulator naukowy`, `Przełączono na {unit}`,
  `Przesunięto w górę do pozycji {position}`, `Obrócono do {degrees}
  stopni`, `Rozpoczęto czytanie`. `Kalkulator podstawowy otwarty` reads as
  a state and is rejected.
- Loading states take the **gerund label** idiomatic in Polish software:
  `Wczytywanie…`, `Wczytywanie kalkulatora…`. The `wczytywać` family is
  used throughout, never `ładować`.
- Descriptions are **noun or verbal-noun phrases** the way Polish software
  names features: `Ekranowa linijka do pomiarów`, `Wyszukiwanie definicji
  wyrazów`, `Powiększanie treści pod ruchomą soczewką`.
- Outcome announcements read as adverbs: `Poprawnie.`, `Częściowo
  poprawnie.`, `Niepoprawnie.`
- Whole sentences are authored whole; no fragment assembly.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any single
string's fidelity.

| English | Polish | Note |
| --- | --- | --- |
| question / items | zadanie / zadania | the exam-paper word (arkusz egzaminacyjny numbers zadania); `pytanie` is one interrogative inside a zadanie; `item` is psychometric jargon |
| passage | tekst | `Przeczytaj tekst…` school phrasing |
| section | część | Polish tests have części; `sekcja` is a calque |
| assessment | test | the delivered test (Polish platform register); `sprawdzian` is a class event, `egzamin` too specific |
| submit | Zatwierdź | the final confirm-and-hand-in control; rejected `Wyślij` (send-register) |
| finish | Zakończ | |
| check answer | Sprawdź odpowiedź | |
| try (noun) | próba | `Pozostała 1 próba. / Pozostały 2 próby. / Pozostało 5 prób.` |
| retry / try again | Ponów / Spróbuj ponownie | |
| loading… | Wczytywanie… | never `Ładowanie…` |
| panel / resize | panel / zmiana rozmiaru | controls: `Zmień rozmiar…` |
| tools / toolbar | narzędzia / pasek narzędzi | |
| toolkit (in prose) | zestaw narzędzi | code identifiers (`assessment`, `updateAssessment(...)`, `requiredTools`) stay verbatim |
| calculator | Kalkulator | podstawowy, naukowy, graficzny |
| graph | Wykres | |
| coordinate plane | układ współrzędnych | the math-education word; `płaszczyzna współrzędnych` rejected for the label |
| grid | siatka | opacity = `krycie` |
| point | punkt | |
| line (drawing mode) | Odcinek | two endpoints draw an odcinek (segment), the school-geometry word; `linia`/`prosta` is the infinite line |
| selector mode | Zaznaczanie | action-name modes: Punkt, Odcinek, Zaznaczanie, Usuń |
| delete | Usuń | |
| periodic table | Układ okresowy | the Polish chemistry term |
| element | pierwiastek | the chemistry word |
| atomic number / atomic mass | liczba atomowa / masa atomowa | `liczba atomowa` is the school term, not `numer atomowy`; spelled out for screen readers |
| electron configuration | konfiguracja elektronowa | |
| phase | stan skupienia | values Stały / Ciekły / Gazowy — adjectives agreeing with the elided `stan`, as Polish tables print them |
| element categories | metal alkaliczny, metal ziem alkalicznych, metal przejściowy, metal postsieciowy, półmetal, niemetal dwuatomowy, niemetal wieloatomowy, gaz szlachetny, lantanowiec, aktinowiec | `półmetal` is the school word over `metaloid` |
| ruler | Linijka | the school drawing instrument; `liniał` is a workshop straightedge |
| inches / centimeters | Cale / Centymetry | sentence forms `cale` / `centymetry` |
| protractor | Kątomierz | the school instrument |
| degrees | stopnie | keep the `°` glyph |
| dictionary | Słownik | |
| entry (dictionary) | hasło | the lexicographic term: `Brak hasła dla „{term}”.`, `{count} haseł`; rejected `wpis` (generic record) |
| picture dictionary | Słownik obrazkowy | |
| picture | obrazek | the picture-dictionary register |
| line reader | Nakładka do czytania | the reading-guide overlay; reading window = `okno czytania`, frame = `ramka` |
| magnifier | Lupa | zoom in/out = `Powiększ` / `Pomniejsz`; lens = `soczewka` |
| highlight(er) | Wyróżnianie / Wyróżnij | Microsoft register; rejected `zakreśl` (pen-on-paper, not UI) |
| underline | Podkreśl / podkreślenie | |
| annotate / annotation | Adnotacja / adnotowanie | PDF-reader register |
| strike through | Przekreśl / przekreślenie | the answer-eliminator action |
| choice (answer option) | opcja odpowiedzi | |
| clear all | Usuń wszystkie | |
| theme | Motyw | never `temat` |
| read aloud | czytać na głos | tool name = `Czytanie na głos` |
| playback speed | tempo czytania | |
| rewind / fast-forward | Cofnij / Przewiń do przodu | |
| preview (visual) | Podgląd | audio preview is a different word: `odsłuch` |
| audio preview | odsłuch | `Odsłuchaj głos`, `Zatrzymaj odsłuch`, `żądanie odsłuchu` |
| sample (TTS text) | przykład | `tekst przykładowy`; the playback itself stays `odsłuch` |
| voice (TTS) | głos | |
| engine (TTS) | silnik | values `Neuronowy` / `Standardowy` |
| sample rate | częstotliwość próbkowania | the Polish DSP term |
| speech marks | znaczniki mowy | |
| word tracking | śledzenie słów | |
| math highlighting | wyróżnianie wzorów | formula = `wzór` |
| sign language | język migowy | Signed English = `migany angielski`, the MCE term in Polish deaf-education literature |
| audio transcript | transkrypcja audio | |
| pixels | piksel | counted inline only inside the `w pikselach` frame (below) |
| media (timed) | nagranie | the timed recording; rejected `media` (press register) |
| district (PNP) | dystrykt | gloss of the US concept |
| accommodation | dostosowanie | the Polish school-legal word |
| provider | dostawca | |
| placement | rozmieszczenie | |
| session / snapshot | sesja / migawka | debugger tables |
| event | zdarzenie | |
| controller / coordinator | kontroler / koordynator | |
| instrumentation | instrumentacja | |
| payload | dane | `szczegóły jego danych`; rejected the calque `ładunek` |
| default | domyślny | `domyślny przeglądarki` (agrees with elided `głos`) |
| host (dev strings) | host | kept Latin in developer panels |
| n/a | n/d | |

## Grammar and agreement pins

- Every plural group carries the counted-noun form proper to its CLDR
  category: **one** → singular nominative (`Pozostała 1 próba.`), **few** →
  plural nominative (`Pozostały 2 próby.`), **many** → genitive plural
  (`Pozostało 5 prób.` — also 21 and 100: Polish treats 21 like 5), **other**
  (fractions) → genitive singular with neuter singular verb (`Pozostało
  1,5 próby.`).
- Inline counts against interpolated numbers avoid agreement entirely by
  framing `w` + locative: `Wysokość okna czytania w pikselach: {pixels}`,
  `Bieżący rozmiar w pikselach: {width} × {height}`. Never `{n} pikseli`
  against an interpolated number, which breaks for 2–4.
- Genderless enums take the unmarked masculine: `any` = Dowolny, `unknown` =
  Nieznany. Where a form agrees with a fixed grammatical subject it follows
  that subject: `(przekreślona)` with `odpowiedź`; `Dowolna/Męska/Żeńska/
  Neutralna` with `płeć`; theme-selector unavailable values agree with
  `motyw` (`{name}, niedostępny`); `lokalny`/`zdalny` with elided `głos`.
- Sentence-internal field labels stay lowercase: `{name}, symbol: {symbol},
  liczba atomowa: {number}, masa atomowa: {mass}, kategoria: {category}`.
  Element category and phase enum values stay capitalized as list entries.
- Sizes join with the multiplication sign: `{width} × {height}`.
- `Graph point {id}` renders without the tool name: `Punkt {id}`, following
  the audited Dutch de-duplication.

## Case and preposition pin (ruler units)

The ruler's unit words serve three interpolation frames. Their
nominative/accusative forms are identical (`cale`, `centymetry`), which the
catalog exploits: `switchedTo` takes `Przełączono na {unit}` (na +
accusative), `applicationA11y` takes `Aktualna jednostka: {unit}`
(nominative). The image alt avoids the locative that would break the shared
form — `Linijka z podziałką: {unit}`, not `…w cale`, which is
ungrammatical. No second word form is introduced, because the key set
carries only `inchesInSentence`/`centimetersInSentence`.

## Punctuation and glyphs

- Quotes are the Polish „ ”; the ellipsis is …; degrees keep °.
- Enum values and control labels are sentence-case; sentence-internal
  labels lowercase (above).

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz; code identifiers in the
PNP prose (`assessment`, `updateAssessment(...)`, `requiredTools`);
instrumentation record kinds and session-db field names
(`all`/`event`/`error`/`metric`/`user-context`/`global-attributes`,
`assessmentId:`, `sectionId:`, `attemptId:`, `mode:`); the SSML tag named in
prose (`emphasis`).

## Plurals — the four categories

CLDR Polish: **one** = the integer 1; **few** = integers with `i % 10` in
2–4 excluding `i % 100` 12–14 (2–4, 22–24, 32–34, 102…); **many** =
integers ending in 0, 1 (except 1 itself), 5–9, and the teens 12–14
(0, 5, 10, 11, 12, 20, 21, 100, 1000); **other** = fractions (1,5 — comma
decimal separator). `Intl.PluralRules("pl")` resolves exactly these four
categories, and every group carries all four, each with `{count}`:

- `player.check.triesLeft`: `Pozostała {count} próba.` / `Pozostały
  {count} próby.` / `Pozostało {count} prób.` / `Pozostało {count} próby.`
- `tools.dictionary.entriesCount`: `{count} hasło` / `{count} hasła` /
  `{count} haseł` / `{count} hasła`
- `tools.pictureDictionary.entriesCount`: `{count} obrazek` / `{count}
  obrazki` / `{count} obrazków` / `{count} obrazka`
- `debug.tts.browserAvailable`: `(wykryto {count} głos)` / `…głosy)` /
  `…głosów)` / `…głosu)` — `wykryto` takes the accusative, which for
  masculine inanimate equals the nominative at 1 and 2–4
- `debug.tts.pollyAvailable`: `(znaleziono {count} pasujący głos, silnik
  {engine})` / `…pasujące głosy…` / `…pasujących głosów…` / `…pasującego
  głosu…`
- `debug.tts.googleAvailable`: `(znaleziono {count} pasujący głos)` /
  `…pasujące głosy)` / `…pasujących głosów)` / `…pasującego głosu)`

## A11y strings

Keys ending `A11y` are complete, self-sufficient screen-reader sentences —
the learner hears them without seeing the layout — and every keyboard
instruction stays concrete. Latin key names stay Latin, as Polish keyboards
print them: Shift, PageUp, PageDown, Escape, +/-, U. Ruler units are spelled
out in full in a11y prose for the same reason English spells them: a screen
reader says `cm` as two letters.
