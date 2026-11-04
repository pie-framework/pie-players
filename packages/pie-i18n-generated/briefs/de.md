# German (de) brief

Serves every German host: registered under the bare `de` tag, so `de-DE`,
`de-AT` and `de-CH` all widen to it. Content flavour is standard German as
German school and assessment software writes it (ILIAS, Moodle DE, IQB/VERA
test delivery); a Swiss host that avoids `ß` can override per key through
`customMessages`.

The instructions the catalog is generated against. A regeneration must follow
the brief current at the generation date recorded in `catalog-manifest.json`;
change this file only together with a regeneration of the locale.

## Register

- **Controls carry the infinitive**, the German UI convention: `Schließen`,
  `Nachschlagen`, `Antwort prüfen`. Never the bare imperative.
- **Sentences and instructions address the learner with `Sie`** — the register
  of German assessment software (Moodle DE, ILIAS): `Versuchen Sie es
  erneut`, `Klicken Sie auf einen Punkt`, `Beantworten Sie Aufgabe
  {position}, um fortzufahren`. Do not drift into `du`; the assessment
  context is formal.
- **Tool state changes are announced as passive events**, never as a bare
  participle, which reads as a state (`Taschenrechner geöffnet` = "the
  calculator is open"): `Einfacher Taschenrechner wurde geöffnet`,
  `Einfacher Taschenrechner wurde geschlossen`.
- **Playback announcements follow the German media-player convention** —
  noun + Partizip II, which German media UI uses as an event announcement:
  `Vorlesen gestartet`, `Vorlesen pausiert`, `Vorlesen fortgesetzt`,
  `Vorgespult`, `Zurückgespult`. Terse tool-move announcements use the same
  form: `Nach oben auf {position} verschoben`.
- **Loading states are the descriptive present passive**, not label
  infinitives: `Wird geladen…`, `Abschnittsinhalt wird geladen…`,
  `Taschenrechner wird geladen…`.
- Whole sentences authored whole; no fragment assembly.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any single
string's fidelity.

| English | German | Note |
| --- | --- | --- |
| question | Aufgabe | what German tests number and deliver: Aufgabe 1, Aufgabe 2 — never the psychometric jargon `Item` |
| items | Aufgaben | learner-facing regions show Aufgaben |
| passage | Text | the reading passage of German tests (`Lies den Text`) |
| section | Abschnitt | the LMS/software register (Moodle DE, ILIAS) for a test part |
| assessment | Prüfung | the education word for the delivered test, not the loanword |
| submit | Abgeben | the exam-room verb (`die Antwort abgeben`), not `Senden` |
| finish | Fertigstellen | the standard German UI word |
| check answer | Antwort prüfen | |
| try | Versuch(en) | `Noch {count} Versuch übrig.` |
| scoring | auswerten | the assessment verb: `wird nicht automatisch ausgewertet` |
| settings | Einstellungen | |
| tool | Hilfsmittel | the exam-aid word: what a German exam permits (`erlaubte Hilfsmittel`) — calculator, ruler, dictionary are Hilfsmittel, not Werkzeuge |
| toolbar | Werkzeugleiste | the GeoGebra German term |
| toolkit | Toolkit | the naturalized loanword, like the audited Dutch; code identifiers (`assessment`, `updateAssessment(...)`, `requiredTools`) stay verbatim |
| panel / pane | Bereich | the Windows German register; `Panel` stays out |
| author | Bearbeiten | the mode pair with `Vorschau`, per the Dutch calibration's finding on `author` |
| enabled / disabled | Ein / Aus | toggle states, not descriptions |
| calculator | Taschenrechner | the German word, never `Kalkulator` |
| basic calculator | Einfacher Taschenrechner | |
| scientific calculator | Wissenschaftlicher Taschenrechner | |
| graphing calculator | Grafikrechner | the vendor register (TI/Casio DE); German education says GTR/grafikfähiger Taschenrechner — the adjective `grafikfähig` appears in the calculator description |
| graph | Graph | der Graph, the math object |
| coordinate plane | Koordinatensystem | THE German math-education word everywhere the plane is named |
| grid (of the graph) | Gitter | the GeoGebra German term for the coordinate grid |
| line (draw mode) | Strecke | two clicked endpoints join into a Strecke; an infinite line would be `Gerade` |
| point | Punkt | `Punkt {id}` — the tool name is not repeated |
| periodic table | Periodensystem | das Periodensystem der Elemente, never a calque of "table" |
| atomic number | Ordnungszahl | the German chemistry word |
| atomic mass | Atommasse | |
| electron config | Elektronenkonfiguration | |
| phase | Aggregatzustand | the German chemistry word for states of matter |
| post-transition metal | Metall der p-Gruppe | the German chemistry classification |
| metalloid | Halbmetall | the German school-chemistry term |
| lanthanide / actinide | Lanthanoide / Actinoide | the IUPAC German series names |
| solid / liquid / gas (phase values) | Fest / Flüssig / Gasförmig | the adjectives German periodic tables print; consistent part of speech |
| ruler | Lineal | the drawing-measuring instrument, not `Messstab` |
| protractor | Winkelmesser | the semicircular angle measurer; `Geodreieck` is the triangular set square, a different instrument — not this tool |
| inches / centimeters | Zoll / Zentimeter | the unit names German software and education use; `Duim`-style folk units stay out |
| dictionary | Wörterbuch | |
| entry (dictionary) | Eintrag | `{count} Einträge`; a miss is singular: `Kein Eintrag für…` |
| picture dictionary | Bildwörterbuch | |
| line reader | Lesehilfe | the reading-guide overlay; its parts are `Lesefenster` (reading window) and `Rahmen` (frame) |
| magnifier | Lupe | the lens is `Linse`; Windows' `Bildschirmlupe` is the OS feature, not this tool |
| zoom in / out | Vergrößern / Verkleinern | |
| highlight (verb) / highlighter (pen) | Hervorheben / Textmarker | the Microsoft register verb; the pen's own German name |
| underline | Unterstreichen | |
| annotate | Annotieren | established in German PDF/academic software |
| annotation | Anmerkung(en) | the feature's German name; the toolbar tool is `Anmerkungen` so it never collides with `Hervorheben` |
| theme | Design | the Microsoft register; Firefox's `Theme` stays out |
| text to speech (tool) | Vorlesen | the read-aloud nominalization German uses for the feature |
| browser TTS / speech synthesis | Sprachausgabe | the German OS/browser term for read-aloud output |
| TTS settings panel | Vorleseeinstellungen | learner language even in the title; the acronym `TTS` is reserved for genuinely technical strings |
| playback / reading speed | Vorlesegeschwindigkeit | |
| read aloud (verb) | vorlesen | |
| strike through | Durchstreichen | the German UI word for the strike-through action |
| answer choices | Antwortmöglichkeiten | the German test-software word |
| look up | nachschlagen | the dictionary action (`ein Wort nachschlagen`) |
| word or phrase | Wort oder Begriff | |
| sign language | Gebärdensprache | |
| audio transcript | Audiotranskript / Transkript | |
| provider | Anbieter | naturalized for the broader audience |
| payload | Nutzdaten | the German technical word |
| snapshot | Momentaufnahme | |
| placement | Platzierung | |
| accommodation | Anpassung | the German assessment-adaptation word in policy prose |
| district | Schulträger | the German school-administration body, not a calque of "district" |
| test administration | Durchführung(srichtlinie) | `Testdurchführung` is the German assessment term |
| resize | Größe ändern | what German UI says, never a literal "Größe modifizieren" |
| clockwise / counterclockwise | im Uhrzeigersinn / gegen den Uhrzeigersinn | |
| media | Medium / Medien | das Medium |
| pixels | Pixel | |
| degrees | Grad | keep the `°` glyph |

## Vocabulary pins

- Quotes are German „…“ (low opening, high closing), including around
  interpolated terms: `„{term}“`.
- Percent takes a space per German convention: `{percent} %`.
- **German capitalizes every noun**, so the finding from the Dutch
  calibration about sentence-internal lowercase labels does not transfer:
  `elementA11y` field labels stay capitalized (`Symbol:`, `Ordnungszahl:`),
  and the two ruler unit forms (`Zoll`/`Zentimeter` and
  `Zoll`/`Zentimeter` in sentence) are identical — the English comment's
  "language that capitalises nouns everywhere" case.
- The compact tool-role formula: `Verschieb- und drehbares Lineal`,
  `Verschieb- und verstellbare Lupe` — one adjective-pair construction per
  tool, not an improvised participle phrase per string.
- Redundancy drops, per the audited Dutch: `toolA11y` of the calculator is
  just `Taschenrechner`; `Graph point {id}` is `Punkt {id}`.
- The gas phase value is the adjective `Gasförmig` like Fest and Flüssig,
  matching the German periodic-table convention (the Spanish catalog's
  noun-rule does not transfer).
- The annotation strip's live-region announcements keep the passive-event
  rule: `„{text}“ wurde gelb hervorgehoben`, `Anmerkung von „{text}“ wurde
  entfernt`, `{count} Anmerkung wurde gelöscht`. With
  `hervorheben`/`unterstreichen` the colour is adverbial and undeclined, so
  German has no colour-agreement problem here; the `{text}` span keeps the
  German quotes „…“, and `Shift+F10` stays Latin.

## Grammar and agreement

- `Hilfsmittel` is neuter: `das Hilfsmittel`, `die Hilfsmittel`.
- `Stimme` is feminine: `{count} passende Stimme(n)`, `Beste verfügbare
  Stimme (automatisch)`.
- Case endings are checked against the real grammatical object: `Klicken Sie
  in das Gitter`, `mit den Pfeiltasten`, `für diese Prüfung`.
- The instrumentality kinds (`all`, `event`, `error`, `metric`,
  `user-context`, `global-attributes`) and the session-db field names
  (`assessmentId:` … `mode:`) stay verbatim identifiers; the debug detail
  labels translate (`Typ:`, `Ziel:`, `Aufgabe:`) and stay capitalized as
  German nouns.

## Untranslated product names

PIE, PNP, TTS (reserved for genuinely technical strings — the settings
panel itself is `Vorleseeinstellungen`), SSML, WaveNet, Studio, Desmos,
Polly, AWS, Google Cloud TTS, Web Speech API, HTTP, JSON, API, MP3, OGG,
PCM, Hz. Signed-language names translate (`Amerikanische Gebärdensprache`).

## Keyboard key names

A11y keys keep the Latin key names German learners see in the framework's
own key caps: `Shift`, `PageUp`, `PageDown`, `Escape`, `+/-`, `U`. Arrow
keys translate (`Pfeiltasten`), since that is what German instructions say.

## Plurals, punctuation

- CLDR `one`/`other`, like English. The six plural groups
  (`player.formative.triesLeft`, `tools.dictionary.entriesCount`,
  `tools.pictureDictionary.entriesCount`, `debug.tts.browserAvailable`,
  `debug.tts.pollyAvailable`, `debug.tts.googleAvailable`) carry both
  categories with the `{count}` placeholder.
- Keep the `…` ellipsis and the `°` glyph; German numbering and quotation
  conventions as pinned above.
