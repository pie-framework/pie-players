# Hebrew (he) brief

Serves every Hebrew host: registered under the bare `he` tag, so `he` and
`he-IL` both widen to it. Content flavour is standard Israeli Hebrew in
the educational register of Hebrew assessment software.

## Register

- Controls carry the infinitive standard in Hebrew UI: `לסגור` (close),
  `לבטל` (cancel), `לשמור` (save), `לאפס` (reset), `להגיש` (submit — the
  exam-hall verb), `לסיים` (finish), `להחיל` (apply). Toolbar buttons may
  take the nominal form where that is the established Hebrew toolbar
  register (`הסרה`, `ניקוי הכול`, `מחיקה`); navigation is nominal
  (`הקודם`/`הבא`).
- Sentences address the learner in the plural-polite imperative
  (`נסו שוב`, `השתמשו בחצי המקלדת`, `בחרו יסוד`), the register Israeli
  edtech writes in; error prose prefers `לא ניתן היה ל…` (could not be…).
- State changes are announced as events in the passive: `מחשבון פשוט
  נפתח`, `הקריאה הושהתה`, `הוחלף ל-{unit}` — never bare stative
  participles.
- Distinct keys never collapse to one label: `common.retry` takes the
  nominal `ניסיון חוזר` while the formative button keeps `לנסות שוב`;
  `common.back` is `חזרה`, distinct from `common.previous` = `הקודם`;
  the annotation toolbar's read-aloud button is `הקראה`, distinct from
  the TTS tool name `קריאה בקול`; the annotation tooltip is `הוספת
  הערות` against the tool name `הערות`, and `debug.resume` = `המשיך`
  stands beside `common.continue` = `להמשיך` without merging.
- Niqqud is absent (standard UI Hebrew); ktiv male where standard
  (`הכול`, `וידאו`). Whole sentences authored whole; no fragment assembly.

## Terminology

| English | Hebrew | Note |
| --- | --- | --- |
| question | שאלה | questions = שאלות; learner-facing regions show שאלות |
| passage | קטע | passages = קטעים |
| section | מקטע | the sub-section term; sections = מקטעים |
| assessment | הערכה | the education-sector word |
| test/exam | מבחן | |
| submit | להגיש | |
| check answer | לבדוק את התשובה | answer = תשובה |
| try (formative) | ניסיון | plural ניסיונות |
| settings | הגדרות | |
| tools | כלים | toolkit = ערכת הכלים |
| calculator | מחשבון | פשוט, מדעי, גרפי |
| graph | גרף | coordinate plane = מישור צירים; drawing = שרטוט |
| grid | רשת | |
| periodic table | הטבלה המחזורית | |
| atomic number / mass | מספר אטומי / מסה אטומית | spelled out for screen readers |
| electron config | תצורה אלקטרונית | the chemistry term, spelled out |
| phase | מצב צבירה | state of matter: מוצק, נוזל, גז |
| ruler | סרגל | |
| inches / centimeters | אינטשים / סנטימטרים | |
| unit | יחידה | |
| protractor | מד זווית | |
| dictionary | מילון | |
| entry (dictionary) | ערך | the lexicography term; plural ערכים |
| picture dictionary | מילון תמונות | |
| Spanish (language name) | ספרדי/ספרדית | `מילון ספרדי`, definitions בספרדית |
| line reader | מדריך קריאה | the reading-guide tool |
| magnifier | זכוכית מגדלת | magnification: `בפי {zoom}` (the Hebrew multiplication prefix) |
| zoom in / out | הגדלה / הקטנה | |
| highlight(er) | הדגשה / מדגיש | |
| underline | קו תחתון | |
| annotate | הערות | annotation = הערה/הערות |
| theme | ערכת נושא | contrast = ניגודיות |
| text to speech | קריאה בקול | learner read-aloud phrasing; הקראת טקסט in technical strings |
| read aloud (annotation) | הקראה | kept distinct from the TTS tool name |
| playback speed | מהירות קריאה | |
| sign language | שפת סימנים | |
| audio transcript | תמליל | audio = שמע, voice = קול |
| strike through | קו חוצה | answer eliminator = השמטת תשובות; eliminated = הושמטה (agrees with אפשרות, feminine) |
| choice (answer) | אפשרות | אפשרויות תשובה |
| pixels | פיקסלים | plural after numerals — standard for the small counts announced |
| degrees | מעלה | keep the `°` glyph |
| voice (TTS) | קול | |
| provider | ספק | |
| teacher | מורה | agency: על ידי (`נבדק על ידי מורה`) |
| accommodation (PNP) | התאמה | |
| read-only | לקריאה בלבד | |
| controller | בקר | |
| snapshot | תמונת מצב | |
| debugger | מנפה באגים | |

## Abbreviations, geresh and gershayim

English abbreviates two periodic-table labels (`Atomic No`,
`Electron Config`); Hebrew carries them spelled out (`מספר אטומי`,
`תצורה אלקטרונית`) — every unit and label in this catalog is spelled out
because a screen reader reads it aloud, the same reason en-US spells out
the ruler units. Hebrew does not borrow the abbreviations. Should native
review introduce an abbreviation, it takes the geresh/gershayim
convention: gershayim inside a multi-letter form (צ״ו style), geresh
after a single letter (מ׳), never a bare apostrophe. None appears in
this catalog as authored.

## RTL conventions

- Hebrew is RTL; `dir` comes from the provider (`localeDirection`),
  never from the catalog. The RTL layout contract is already audited (the
  framework's `ar` locale plus section-player's rtl-layout geometry
  spec), so strings carry no layout work — only in-string bidi rules.
- Digits are Western (`latn`), matching the CLDR default for `he` and the
  ar precedent: every literal digit (`0`, `10`, `180`, the `1` in
  `speedOptionsHelp`, the `8000 Hz` sample rates) is Western, as is `%`
  (`{percent}%`).
- Punctuation glyphs: Latin comma `,`, semicolon `;`, full stop `.` and
  question mark `?` are the standard Hebrew punctuation and are what the
  catalog uses (no string needs `?`). The lookup notices take curly
  quotes `“{term}”`. The `…` ellipsis is kept.
- Hebrew-letter prefixes before Latin tokens or numerals are hyphenated,
  standard Israeli tech style: `ה-requiredTools`, `ל-updateAssessment(...)`,
  `ב-Shift+חצים`, `ב-Escape`, `ל-{degrees} מעלות`, `ה-API`. The hyphen
  between a Hebrew letter and a Latin run takes the RTL base direction
  and renders in place; no RLM is inserted.
- Bidi in strings: a Latin token never stands immediately before
  terminal punctuation. Latin product names open sentences (`Web Speech
  API אינו זמין בדפדפן זה.`, `Google Cloud TTS אינו זמין דרך ה-API
  שהוגדר.`) or sit mid-sentence with Hebrew on both sides (`ערכת
  הנושא…של PIE נשארת פעילה…`); labels may end in a bare Latin token only
  when nothing follows (`נקודת קצה של API`, `JSON של הסביבה`). The
  `'{id}'` and `({status})` interpolations keep the ar precedent's
  straight quotes and neutral clustering. No RLM/LRM control characters
  are embedded — data stays direction-agnostic.
- Key names stay Latin inside A11y sentences: Shift, PageUp, PageDown,
  Escape, +/-, U (`ב-Shift+חצים כדי לסובב`, `ב-PageUp או PageDown`,
  `במקשי + ו-`).

## Untranslated product names

PIE, PNP, TTS (in genuinely technical strings only; learner-facing panels
say קריאה בקול), SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud
TTS, Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz, `/api/tts`,
`en-US`, and the record-kind/session-db identifier strings
(`instrumentationKind*`, `sessionDb*`), verbatim across locales.

## Plurals — three CLDR categories, the only `two` in the wave

`Intl.PluralRules("he")` yields `one` (n = 1), `two` (n = 2) and
`other`. All six count groups (`player.formative.triesLeft`,
`tools.dictionary.entriesCount`, `tools.pictureDictionary.entriesCount`,
`debug.tts.browserAvailable`, `debug.tts.pollyAvailable`,
`debug.tts.googleAvailable`) carry exactly `one`/`two`/`other`, each
category holding `{count}` (and `{engine}` on `pollyAvailable`). With
numerals, `two` takes the plural noun form (`{count} ערכים`,
`{count} ניסיונות`, `{count} קולות`), so its text matches `other`; only
`one` inflects (`{count} ערך`, `{count} ניסיון`, `{count} קול`).
Measurement nouns in the pixel announcements carry the plural form
(`פיקסלים`), standard for the small counts these UIs announce.
