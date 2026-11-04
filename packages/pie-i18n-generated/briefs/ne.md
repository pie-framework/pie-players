# Nepali (ne) terminology brief

Serves every Nepali host: the catalog is registered under the bare `ne`
tag, so `ne` and `ne-NP` widen to it. Register is the neutral written
Nepali of Nepali-medium schooling and edtech. **Assessment terminology in
Nepali is only partially standardized** — the state/regional wave carries
this flag in the manifest — so this brief pins deliberate choices and lists
every judgment call under "Terminology confidence" for the native reviewer.

## Register

- The polite `तपाईं` register throughout: controls and instructions carry
  the honorific `-नुहोस्` imperative (`बन्द गर्नुहोस्`, `उत्तर जाँच्नुहोस्`,
  `बुझाउनुहोस्`), exactly the register Nepali Windows and Nepali edtech
  print. No plain 2sg (`गर्दा`-style bare forms) and no lower honorific.
- Sentences keep `तपाईंका` possessives where English has them
  (`तपाईंका सुरक्षित उत्तरहरू`) — dropping them would read stiffer than
  the software convention, unlike Vietnamese where omission is the norm.
- State-change announcements are events: `खुल्यो` (opened), `बन्द भयो`
  (closed), `सारियो` (moved), `घुमाइयो` (rotated), `रेकर्ड गरियो`
  (recorded) — never a bare participle.
- Whole sentences authored whole; no fragment assembly.
- Capitalization follows Devanagari practice: no mid-string capitals exist;
  short labels keep their natural form.

## Script and orthography

- Devanagari with standard conjuncts (`गर्नुहोस्`, `मूल्याङ्कन`, `सञ्झ्याल`,
  `पङ्क्ति`), and **no nukta forms**: Nepali prints `कस्टम`-style words
  without the nukta dot, so borrowed forms are written as Nepali software
  prints them (`क्याल्कुलेटर`, `ब्राउजर`, `क्लिक`, `टूलबार`, `प्रोट्याक्टर`).
- Anusvara where Nepali spells it (`हुँदै`, `गरिँदैन`, `चलिरहँदा`), not a
  nasal consonant.
- **Digits: Devanagari numerals (०१२३), pinned deliberately.** Nepali
  school materials — textbooks, exam papers, exercise books — print
  numbers in Devanagari digits, and Nepali-medium software that serves
  schools follows them. Pedagogical prose therefore uses them:
  the protractor image description reads `० देखि १८० डिग्रीसम्म…`, and
  `speedOptionsHelp` says `१ समावेश गर्नुहोस्`. Every `{count}`,
  `{position}`, `{percent}` placeholder interpolates whatever the host
  passes; the catalog itself adds no digits around those.
  **The assessment-software tension, documented:** technical and
  API-facing literals stay Western because they name machine values, not
  classroom numbers — `8000 Hz`…`24000 Hz` (audio interop), `HTTP
  {status}`, `/api/tts`, `en-US`. If a host audience is exam-proctor
  mixed rather than Nepali-medium schooling, Arabic digits everywhere is
  the override a host can make per key; the split here follows the
  school-material convention the brief was asked to pin.
- **The danda `।` (U+0964) terminates every Nepali sentence** — the full
  stop Nepali exam software typesets (`सकिएन।`, `गर्नुहोस्।`). The Latin
  dot never terminates a Nepali sentence in this catalog; it survives only
  inside verbatim technical literals (`8000 Hz`, `HTTP {status}: {message}`).

## Terminology

| English | Nepali | Note |
| --- | --- | --- |
| question | प्रश्न | a delivered question; plural `प्रश्नहरू` |
| items | प्रश्नहरू | learner-facing regions show प्रश्नहरू; "item" is psychometric jargon |
| passage | गद्यांश | the Nepali school word for a prose passage |
| section | खण्ड | the school word for a test part; plural `खण्डहरू` |
| answer | उत्तर | |
| correct | ठीक | `ठीक छ।` / `आंशिक रूपमा ठीक छ।` / `ठीक छैन।` |
| submit | बुझाउनुहोस् | hand in, the exam register (not `पेश`) |
| finish | समाप्त गर्नुहोस् | |
| check answer | उत्तर जाँच्नुहोस् | `जाँच्नु` = verify |
| try / attempt | प्रयास | `फेरि प्रयास गर्नुहोस्`; `{count} प्रयास बाँकी छ।` |
| settings | सेटिङहरू | the standard Nepali UI loan |
| tool(s) | उपकरण | the proper Nepali word (not `टुल`) |
| toolbar | टूलबार | the Windows-Nepali loan |
| panel | प्यानल | loan |
| window | सञ्झ्याल | the Nepali word, as Windows Nepali prints it |
| assessment | मूल्याङ्कन | evaluation; `परीक्षा` (exam) stays out of chrome |
| content | सामग्री | |
| media | मिडिया | loan |
| region | क्षेत्र | |
| resize | आकार परिवर्तन गर्नुहोस् | change the size |
| narrower / wider / shorter / taller | साँघुरो / फराकिलो / छोटो / अग्लो बनाउनुहोस् | make-narrow/wide/short/tall — pinned pattern |
| minimize / maximize | सानो गर्नुहोस् / ठूलो गर्नुहोस् | make small / make big — flagged |
| drag | तान्नुहोस् | pull |
| click | क्लिक गर्नुहोस् | loan |
| clockwise | घडीको दिशामा | the clock's direction; counterclockwise = `घडीको विपरीत दिशामा` |
| calculator | क्याल्कुलेटर | loan; basic `साधारण`, scientific `वैज्ञानिक`, graphing `ग्राफ` |
| graph | ग्राफ | loan |
| coordinate plane | निर्देशांक तल | `निर्देशांक` = coordinate, `तल` = plane — the Nepali math-education term |
| grid | जाली | net/lattice |
| point | बिन्दु | |
| line | रेखा | |
| draw | कोर्नु | |
| selector mode | चयनकर्ता | action-name modes: चयनकर्ता, बिन्दु, रेखा, मेट्नुहोस् |
| delete | मेट्नुहोस् | |
| periodic table | आवर्त तालिका | the Nepali chemistry term (`आवर्त` = periodic) |
| element | तत्व | plural `तत्वहरू` |
| atomic number / mass | परमाण्विक संख्या / परमाण्विक भार | the textbook adjectival form; spelled out for screen readers |
| electron configuration | इलेक्ट्रोन विन्यास | the textbook term |
| phase | अवस्था | solid `ठोस`, liquid `तरल`, gas `ग्यास` |
| category (element) | वर्ग | |
| ruler | स्केल | what Nepali pupils actually call it — flagged |
| inches / centimeters | इन्च / सेन्टिमिटर | loans; sentence forms identical (Nepali has no case capitalization to vary) |
| protractor | प्रोट्याक्टर | loan — flagged; the pupils' colloquial `डी` is out of register |
| degrees | डिग्री | loan; keep the `°` glyph |
| arrow keys | एरो कुञ्जीहरू | `कुञ्जी` = key |
| unit | एकाइ | |
| dictionary | शब्दकोश | the word-store compound, standard |
| entry (dictionary) | प्रविष्टि | plural `प्रविष्टिहरू` |
| picture dictionary | चित्र शब्दकोश | |
| Spanish | स्पेनिस | `स्पेनिस शब्दकोश` — flagged (`स्पेनी` variant) |
| line reader | पङ्क्ति पाठक | row-reader compound — flagged |
| reading window | पढ्ने सञ्झ्याल | |
| frame | फ्रेम | loan |
| magnifier | आवर्धक | the proper Nepali/Hindi word for magnifier |
| zoom in / out | जुम बढाउनुहोस् / घटाउनुहोस् | increase/decrease zoom |
| highlight(er) | हाइलाइट / हाइलाइटर | loans, as Nepali software prints them |
| underline | अधोरेखांकन | the under-line-marking word |
| annotate / annotation | टिप्पणी गर्नुहोस् / टिप्पणी | note/marginalia, standard |
| strike through | काट्नु | cut/strike, what Nepali pupils say for crossing out |
| choice (answer option) | विकल्प | |
| read aloud | ठूलो स्वरले पढ्नुहोस् | read in a loud voice; text-to-speech = `पाठ वाचन` (reading aloud) |
| playback speed | वाचन गति | `गति` = speed |
| pause | विराम | the pause/break word, Windows Nepali's verb |
| theme | थिम | loan — flagged |
| contrast | कन्ट्रास्ट | loan — flagged |
| sign language | सांकेतिक भाषा | sign-based language |
| transcript | प्रतिलिपि | a written copy |
| session | सत्र | |
| event | घटना | |
| controller | नियन्त्रक | |
| coordinator | कोअर्डिनेटर | transliteration — flagged |
| provider | प्रदायक | |
| filter | फिल्टर | loan |
| toolkit (the package, in prose) | टूलकिट | the standard Nepali tech loan; code identifiers (`assessment`, `updateAssessment(...)`, `requiredTools`) stay verbatim |
| accommodation | सुविधा | facility, the Nepali special-education word |
| placement | स्थान | place/position |
| district | जिल्ला | the Nepali administrative district |
| read-only | पढ्ने मात्र | only reading |
| support / prohibit (policy) | अनुमति दिनु / निषेध गर्नु | allow / forbid, the policy verbs |
| default | पूर्वनिर्धारित | the standard Nepali software word |
| multiplier (speed) | गुणक | |
| formula | सूत्र | |
| alignment (math) | मिलान | |
| enabled / disabled | सक्रिय / निष्क्रिय | active/inactive pair; `{state}` values read `अन`/`बन्द` |
| accessible | पहुँचयोग्य | |
| pixel | पिक्सेल | loan |

## Vocabulary pins

- Quotes are the curly `“”`; the en-US glyphs must survive.
- `common.author` is the authoring-mode label `लेखक` next to `पूर्वावलोकन`
  (preview) — Nepali software prints the writer word for the authoring
  mode; the mode reading is noted in the confidence list.
- `common.enabled`/`disabled` render as toggle states `सक्रिय`/`निष्क्रिय`;
  the `{state}` value in `headerRowReservation` reads `अन`/`बन्द`, matching
  `common.off`.
- Genitive choice: `{term}का लागि` uses the oblique `का` because the term's
  gender is unknown; a native pass may prefer `को` for masculine defaults.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API, MP3, OGG, PCM, Hz, `emphasis` (the SSML
tag named in prose); the instrumentation record kinds (`all`, `event`,
`error`, `metric`, `user-context`, `global-attributes`) and session-db field
names (`assessmentId:`…) verbatim, like every locale.

## Terminology confidence

Judgment calls made without strong evidence, in priority order for the
native reviewer:

1. **ruler = स्केल** ("scale") — what Nepali pupils actually call the
   instrument; the dictionary word `रुलर`/`मापक` exists but `स्केल` is the
   classroom register. Watch for collision with "scale" meanings elsewhere.
2. **protractor = प्रोट्याक्टर** is the transliteration; pupils say `डी`
   (colloquial, out of register) and some textbooks print `डी गोलो` — a
   native pass should confirm the print form.
3. **line reader = पङ्क्ति पाठक** (row-reader) is a coined compound; no
   established Nepali UI term exists for this tool.
4. **minimize / maximize = सानो/ठूलो गर्नुहोस्** (make small/big) —
   Windows Nepali used borrowed `कम/बढी`-family verbs in places; the
   make-small/make-big pair was chosen for clarity and consistency.
5. **theme = थिम** and **contrast = कन्ट्रास्ट** are loans; proper Nepali
   `रङयोजना`/`विषय` exist but Nepali software overwhelmingly prints the
   loans. `थिम` also collides mildly with `विषय` (topic) — the loan
   avoids that.
6. **contrast in `theme.description` = कन्ट्रास्ट**; `अन्तर` (difference)
   is the Nepali alternative if the loan reads too technical.
7. **strike through = काट्नु** (cut) — pupils' word; formal
   `विलोपन चिह्न` exists but is out of register for a toolbar tooltip.
8. **coordinator = कोअर्डिनेटर** transliteration in dev panels;
   `समन्वयकर्ता` is the proper word if a native pass prefers it.
9. **instrumentation = इन्स्ट्रुमेन्टेसन** transliteration — the telemetry
   sense has no established Nepali term; `मापन` (measurement) is the
   alternative.
10. **Spanish = स्पेनिस** vs `स्पेनी`: both print; the noun form was
    pinned for the dictionary names.
11. **Genitive `का` in `{term}का लागि`** — gender-neutral default; check
    against `को` conventions for quoted unknowns.
12. **pause = विराम** as both noun and `{state}`-adjacent value;
    `अस्थायी रोक्का` (temporary stop) is the verbose alternative.

## Plurals, punctuation

- `Intl.PluralRules("ne")` selects exactly `one` (n = 1) and `other`; both
  are carried in all six plural groups with `{count}` in each.
- **Nepali keeps the noun singular after a numeral** (`दुई किताब`), so the
  plural groups vary the **verb**, not the noun: `{count} प्रयास बाँकी छ।`
  / `{count} प्रयास बाँकी छन्।`; the availability announcements vary
  `आवाज`/`आवाजहरू` around the numeral where the natural phrasing allows it.
- Sentence ends carry the **danda `।`** (the Devanagari full stop Nepali
  exam software typesets); keep the `…` ellipsis, curly quotes and the
  `°` glyph; the Latin dot never terminates a Nepali sentence here.
- Devanagari numerals in pedagogical prose (`१`, `०`–`१८०`), Western digits
  in technical literals (`8000 Hz`, `HTTP {status}`) — see Digits.
