# Amharic (am) terminology brief

Serves every Amharic host: the catalog is registered under the bare `am`
tag, so `am` and `am-ET` widen to it. Register is the neutral written
Amharic of Ethiopian schooling and edtech. **Assessment terminology in
Amharic is only partially standardized** — the state/regional wave carries
this flag in the manifest — so this brief pins deliberate choices and lists
every judgment call under "Terminology confidence" for the native reviewer.

## Register

- Controls carry the 2sg imperative: `ዝጋ` (close), `ሰርዝ` (cancel),
  `መልስ አረጋግጥ` (check answer), `አስገባ` (submit), `ጨርስ` (finish).
- Instruction prose and hints carry the polite plural (`ይጠቀሙ` use,
  `ይሞክሩ` try again, `ይጻፉ` type) — the register Windows Amharic
  established, split per string class the way the calibration requires
  (imperative controls, polite sentences).
- State-change announcements are events in the perfective passive:
  `ተከፈተ` (was opened), `ተዘጋ` (was closed), `ተንቀሳቅሷል` (has moved),
  `ተሽከርክሯል` (has rotated) — never a bare adjective.
- Where English carries a possessive, Amharic keeps the polite form
  (`የእርስዎ` in `restoreFailed`).
- Whole sentences authored whole; no fragment assembly.

## Script and orthography

- Ethiopic (Ge'ez) fidel throughout, with the **sixth-order letter for word
  -final consonants** per convention (`መሣሪያ`, `መስመር`, `ቀጣይ` — never a
  synthetic -ə final).
- Word boundaries use spaces as modern Amharic software does; compound
  technical terms take the space or hyphen they are printed with in
  Ethiopian usage (`በራስ-ሰር`, `ወቅታዊ ሠንጠረዥ`).
- **Authentic Ethiopic punctuation** replaces Latin marks:
  ፣ (comma), ፤ (semicolon), ፥ (colon for "Label: value" and prefaces ፦),
  ። (period). No ASCII `;` `:` `.` appears inside translated prose —
  the ones that survive are glyphs the source itself carries
  (`…`, `“”`, `°`, `+`, `-`, `{placeholder}` braces) and verbatim
  technical literals (`HTTP {status}: {message}` keeps its ASCII colon as
  part of the identifier-like pattern).
- **Digits: Arabic (Western) digits, pinned.** Ge'ez numerals (፩፪፫፬…) exist
  and remain liturgical and traditional-print usage; Ethiopian software,
  including Amharic Windows and mobile UI, renders numbers with 0–9 and
  learners meet Western digits in Ethiopian math exams for any
  machine-rendered value. Every `{count}`, `{position}`, `{percent}`,
  `{zoom}` and `{degrees}` therefore interpolates Western digits, and
  written-out numbers inside prose (`ከ0 እስከ 180 ዲግሪ`) use them too. The
  assessment-software tension — some Ethiopian print materials still use
  Ge'ez numerals — is acknowledged; if a host wants Ge'ez numerals it is
  a formatting-layer concern, not a catalog concern.

## Terminology

| English | Amharic | Note |
| --- | --- | --- |
| question | ጥያቄ | a delivered question; plural `ጥያቄዎች` |
| items | ጥያቄዎች | learner-facing regions show ጥያቄዎች; "item" is psychometric jargon |
| passage | ጽሑፍ | a reading text; plural `ጽሑፎች` |
| section | ክፍል | the school/test word for a part; plural `ክፍሎች` |
| answer | መልስ | plural `መልሶች` |
| correct | ትክክል | `ትክክል ነው።` / `ከፊል ትክክል ነው።` / `ትክክል አይደልም።` |
| submit | አስገባ | cause-to-enter, the exam-hand-in register |
| finish | ጨርስ | |
| check answer | መልስ አረጋግጥ | `አረጋግጥ` = verify |
| try / attempt | ሙከራ | plural `ሙከራዎች`; `{count} ሙከራ ቀርቧል።` |
| settings | ቅንብሮች | Windows Amharic's word |
| tool(s) | መሣሪያ / መሣሪያዎች | |
| toolbar | የመሣሪያ አሞሌ | `አሞሌ` = bar/board |
| panel | ሰሌዳ | board/tablet — flagged |
| window | መስኮት | |
| assessment | ግምገማ | evaluation; `ፈተና` (exam) stays out of chrome |
| screen | ስክሪን | loan |
| media | ሚዲያ | loan |
| resize | መጠን መቀየር / መጠን ቀይር | change the size |
| narrower / wider | ስፋቱን ቀንስ / ጨምር | decrease/increase the width — pinned pattern |
| shorter / taller | ቁመቱን ቀንስ / ጨምር | decrease/increase the height |
| minimize / maximize | ያንሳ / አስፋ | reduce / spread — flagged |
| drag | ጎትት | pull |
| click | ጠቅ አድርግ | |
| arrow key | ምስማር ቁልፍ | `ምስማር` = arrow, `ቁልፍ` = key |
| clockwise | የሰዓት አቅጣጫ | the clock's direction |
| calculator | ማስያ | the standard word; basic `መሰረታዊ`, scientific `ሳይንሳዊ`, graphing `ግራፍ` |
| graph | ግራፍ | loan, as Ethiopian math education prints it |
| coordinate plane | ኮኦርዲኔት ስርዓት | the coordinate system — flagged |
| grid | ሸራርባ | lattice — flagged |
| point | ነጥብ | the math word; plural `ነጥቦች` |
| line | መስመር | plural `መስመሮች` |
| selector mode | ምርጫ | action-name modes: ምርጫ, ነጥብ, መስመር, አጥፋ |
| delete | አጥፋ | |
| periodic table | ወቅታዊ ሠንጠረዥ | `ሠንጠረዥ` = table |
| element | ንጥረ ነገር | Ethiopian chemistry's word; plural `ንጥረ ነገሮች` |
| atomic number / mass | አቶሚክ ቁጥር / ግዝፈት | spelled out for screen readers; mass = `ግዝፈት` — flagged |
| phase | ሁኔታ | solid `ጠንካራ`, liquid `ፈሳሽ`, gas `ጋዝ` |
| category (element) | ምድብ | |
| ruler | ሚያዝያ | the school ruler |
| inches / centimeters | ኢንች / ሴንቲሜትር | loans; both sentence forms identical |
| protractor | የማዕዘን መለኪያ | the angle-measurer (`ማዕዘን` = angle) |
| degrees | ዲግሪ | loan; keep the `°` glyph |
| dictionary | መዝገበ ቃላት | the word-collection compound |
| entry (dictionary) | መዝገብ | record; plural `መዝገቦች` |
| picture dictionary | የምስል መዝገበ ቃላት | |
| Spanish | ስፓንኛ | `የስፓንኛ መዝገበ ቃላት` — flagged |
| line reader | የመስመር አንባቢ | the line reader |
| reading window | የንባብ መስኮት | `ንባብ` = reading |
| frame | ጭብጥ | the covering/wrapping frame — flagged |
| magnifier | ማጉሊያ | instrument noun from `ማጉላት` (enlarge) |
| zoom in / out | አቅራብ / ራቅ | approach / go far |
| highlight(er) | ማስደመቅ / ማስደመቂያ | make-shine, the Amharic rendering of highlight |
| underline | በታች መስመር ስል | draw a line under |
| annotate / annotation | ማስታወሻ መስጠት / ማስታወሻ | note-giving / note |
| strike through | በመስመር መሻገር | crossing with a line — flagged |
| choice (answer option) | ምርጫ | |
| eliminate | ማስወጋት | cause to leave |
| read aloud | በድምፅ ማንበብ / በድምፅ አንብብ | read with voice |
| playback speed | የንባብ ፍጥነት | reading speed (`ፍጥነት` = speed) |
| pause | ለጊዜው አቁም | stop for now; announcement `ለጊዜው ቆሟል` |
| theme | ገጽታ | appearance, Windows Amharic's word |
| contrast | ንፅፅር | — flagged |
| sign language | የእጅ ምልክት ቋንቋ | hand-sign language |
| transcript | ቅጂ | a written copy |
| session | ክፍለ ጊዜ | period-of-time, Windows Amharic's session |
| data | ውሂብ | |
| event | ክንውን | |
| controller | መቆጣጠሪያ | |
| coordinator | አስተባባሪ | |
| provider | አቅራቢ | |
| filter | ማጣሪያ | from sifting |
| toolkit (the package, in prose) | መሣሪያ ጥቅል | the tool bundle; code identifiers (`assessment`, `updateAssessment(...)`, `requiredTools`) stay verbatim |
| accommodation | ማመቻቸት | facilitation — flagged |
| placement | አቀማመጥ | |
| district | አውራጃ | the Ethiopian administrative district |
| read-only | ለማንበብ ብቻ | for reading only |
| support / prohibit (policy) | ፍቀድ / ተከልክል | allow / forbid, the policy verbs |
| default | ነባር / ነባሮች | Windows Amharic's default |
| multiplier (speed) | ማባዣ | from `ማባዛት` multiply |
| formula | ቀመር | |
| alignment (math) | አሰላለፍ | |
| pixel | ፒክስ | the short form Ethiopian UI prints |

## Vocabulary pins

- Quotes are the curly `“”`; the en-US glyphs must survive.
- `common.author` is the authoring-mode position: `ደራሲ` was rejected as a
  person word next to the `ቅድመ እይታ` (preview) mode; the pair is
  `ደራሲ`/`ቅድመ እይታ` as Windows prints them — the mode reading is noted in
  the confidence list.
- `common.enabled`/`disabled` render as toggle states `ንቁ`/`አንቁ`
  (active/inactive), and `{state}` values in `headerRowReservation` read
  `በርቷል`-style (lit) per `debug.pnp.on`.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz, `emphasis` (the SSML
tag named in prose); the instrumentation record kinds (`all`, `event`,
`error`, `metric`, `user-context`, `global-attributes`) and session-db field
names (`assessmentId:`…) verbatim, like every locale.

## Terminology confidence

Judgment calls made without strong evidence, in priority order for the
native reviewer:

1. **coordinate plane = ኮኦርዲኔት ስርዓት** (coordinate system). Ethiopian
   textbooks may print `ኮኦርዲኔት ወረዳ` or the plain loan; the system
   reading was chosen for stability across descriptions and tooltips.
2. **grid = ሸራርባ** (lattice/grating). A verified Ethiopian UI term for the
   graph grid was not found; `ግራፍ መስመሮች` is the alternative.
3. **contrast = ንፅፅር** is the comparison word; Ethiopian UI may keep the
   loan `ኮንትራስት`.
4. **atomic mass = አቶሚክ ግዝፈት** (`ግዝፈት` = mass in physics texts).
   `ክብደት` (weight) is the colloquial alternative; physics register was
   preferred.
5. **minimize / maximize = ያንሳ / አስፋ**. Windows Amharic may use
   `አሳምም`-family verbs; the reduce/spread pair was chosen for consistency
   with the width/height ቀንስ/ጨምር pattern.
6. **strike through = በመስመር መሻገር** (crossing with a line) — no verified
   Amharic strikethrough convention; underline deliberately uses መሳል
   (draw) so the two actions do not collide.
7. **highlight = ማስደመቅ** (make shine) — the common Amharic rendering, but
   confirm against Ethiopian Office localization.
8. **element category transliterations** (`ሜታሎይድ`, `ድያቶሚክ`,
   `ፖሊአቶሚክ`, `ላንታኒድ`, `አክቲኒድ`) follow transliteration rather than
   Ethiopian chemistry print, which may differ per term;
   `ድያቶሚክ ብረት ያልሆነ ንጥር` word order (relative clause before head) is
   grammatical Amharic but verbose.
9. **noble gas = ውብ ጋዝ** (`ውብ` = noble/pure); Ethiopian chemistry may
   print `ኢነርት ጋዝ` or `ንቁ ያልሆነ ጋዝ`.
10. **Spanish = ስፓንኛ** — confirm against the Ethiopian print of the
    language name (`ስፔንኛ` is the variant seen).
11. **panel = ሰሌዳ**, **frame = ጭብጥ**, **transcript = ቅጂ** are functional
    choices without a verified UI pedigree; a native pass may prefer
    `ፓነል`/`ፍሬም` loans.
12. **student-facing player = ፕሌየር** (loan) in `playerError` only;
    everywhere else the player is never named.
13. **request (HTTP) = ጥያቄ** in `showSectionRequest` collides with
    question (`ጥያቄ`) in the developer panel; accepted because the two
    never sit in the same view, and `መጠየቅ` reads as a verb.

## Plurals, punctuation

- `Intl.PluralRules("am")` selects exactly `one` (n in 0..1) and `other`;
  both are carried in all six plural groups with `{count}` in each.
- Amharic takes plural agreement in the `other` categories:
  `{count} ሙከራ ቀርቧል።` / `{count} ሙከራዎች ቀርበዋል።`; the availability
  announcements likewise switch `ተገኝቷል`/`ተገኝተዋል` and noun number.
- Punctuation is the Ethiopic set (፣ ፤ ፥ ፦ ።); keep the `…` ellipsis,
  curly quotes and the `°` glyph; Amharic question punctuation does not
  arise in this catalog.
