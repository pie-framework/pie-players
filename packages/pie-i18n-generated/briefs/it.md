# Italian (it) brief

Serves every Italian host: registered under the bare `it` tag, so `it-IT` and
`it-CH` widen to it. Content flavour is standard Italian as Italian school and
assessment software writes it (INVALSI delivery register, Moodle it, the
digital tools of the major school publishers).

The instructions the catalog is generated against. A regeneration must follow
the brief current at the generation date recorded in `catalog-manifest.json`;
change this file only together with a regeneration of the locale.

## Register

- **Controls carry the impersonal infinitive**, the formal-neutral Italian UI
  convention — chosen over the modern consumer `tu`-imperative because an
  assessment must not presume familiarity: `Chiudere`, `Salvare`,
  `Consegnare`, `Verificare la risposta`. Error sentences end with the same
  infinitive tag Italian system dialogs use: `Riprovare.`
- **Instructions inside sentences stay impersonal**: `fare clic` (the
  Microsoft Italian phrase), `Rispondere alla domanda {position} per
  continuare`.
- **Events are authored so the sentence has a real subject or an event
  noun**, never a dangling gendered participle: `La risposta è stata
  registrata.`, `Apertura della calcolatrice base`, `Spostamento in alto
  verso {position}`, `Rotazione a {degrees} gradi`. Read-aloud playback
  announcements state the subject and agree with it: `Lettura avviata`,
  `Lettura ripresa`, `Lettura in pausa`, `Lettura interrotta`.
- Loading states are noun phrases: `Caricamento…`, `Caricamento del
  contenuto della sezione…`.
- Possessives only where unavoidable; `Non è stato possibile ripristinare le
  risposte salvate di questa sezione` needs none.
- Whole sentences authored whole; no fragment assembly.

## Terminology

Fixed choices, reused for every occurrence. Consistency outranks any single
string's fidelity.

| English | Italian | Note |
| --- | --- | --- |
| question | domanda | what Italian tests deliver; `quesito` stays out as exam-paper prose |
| items | domande | learner-facing regions show domande |
| passage | brano | the Italian school word: `leggi il brano`; `testo` alone reads as "text" generally |
| section | sezione | the Italian assessment-software word for a test part |
| assessment | prova | the INVALSI/education word for the delivered test, not the loanword |
| submit | Consegnare | the school verb (`consegnare il compito`), not `Inviare` |
| finish | Terminare | |
| check answer | Verificare la risposta | |
| try | tentativo/i | `Rimane ancora {count} tentativo.` |
| scoring | valutare | the Italian school verb: `non è valutata automaticamente` |
| settings | Impostazioni | |
| tool | strumento | |
| toolbar | barra degli strumenti | the Italian Windows/Office term |
| toolkit | toolkit | the naturalized loanword, like the audited Dutch; code identifiers (`assessment`, `updateAssessment(...)`, `requiredTools`) stay verbatim |
| panel | pannello | |
| author | Modifica | the mode pair with `Anteprima`, per the Dutch calibration's finding on `author` |
| enabled / disabled | Attivato / Disattivato | |
| calculator | calcolatrice | base, scientifica, grafica — the vendor register (TI/Casio it) |
| graph | Grafico | |
| coordinate plane | piano cartesiano | THE Italian math-education word everywhere the plane is named |
| grid | griglia | |
| line (draw mode) | Segmento | two clicked endpoints join into a segment; an infinite line would be `Retta` (GeoGebra it keeps the distinction) |
| point | Punto | `Punto {id}` — the tool name is not repeated |
| canvas | area di disegno | |
| periodic table | Tavola periodica | la Tavola periodica degli elementi, capitalized as Italian chemistry writes it |
| atomic number | Numero atomico | spelled out for screen readers |
| atomic mass | Massa atomica | |
| electron config | Configurazione elettronica | the Italian chemistry term |
| phase | Stato | `stato` (di aggregazione) — the Italian chemistry word for states of matter |
| post-transition metal | Metallo del blocco p | the Italian chemistry classification |
| metalloid | Metalloide | |
| lanthanide / actinide | Lantanide / Attinide | |
| solid / liquid / gas (phase values) | Solido / Liquido / Gas | the nouns, `Gas` not the adjective `gasoso` — consistent part of speech |
| ruler | Righello | |
| protractor | Rapportatore | the Italian school instrument; `goniometro` is the technical/medical device |
| inches / centimeters | Pollici / Centimetri | sentence forms lowercase (`pollici`, `centimetri`): Italian does not capitalize common nouns, so the two ruler forms differ, as English intends |
| dictionary | Dizionario | |
| entry (dictionary) | voce | the Italian dictionary term (`voce di dizionario`); `{count} voci`; a miss is `Nessuna voce per…` |
| picture dictionary | Dizionario illustrato | the established Italian term |
| line reader | Guida di lettura | the reading-guide overlay; `guida alla lettura` avoided for its literary-criticism sense; parts: `finestra di lettura`, `cornice` (frame) |
| magnifier | Lente di ingrandimento | the Italian OS term (Windows it) |
| zoom in / out | Ingrandire / Ridurre | |
| highlight (verb) / highlighter (pen) | evidenziare / Evidenziatore | |
| underline | sottolineare | |
| annotate | annotare | |
| annotation | annotazione | the toolbar tool is `Annotazione`; its tooltip `Annotare` never collides with `Evidenziare` |
| theme | Tema | |
| text to speech (tool) | Lettura ad alta voce | the read-aloud phrasing; the settings panel is `Impostazioni della lettura ad alta voce` — the TTS acronym stays out of learner-facing titles |
| read aloud (verb) | leggere ad alta voce | |
| browser TTS | sintesi vocale | the Italian OS/browser term for read-aloud output |
| playback / reading speed | Velocità di lettura | |
| word tracking | seguimento delle parole | the read-along feature, not a calque of "tracking" |
| strike through | barrare | the Italian exam action for crossing out an answer choice |
| answer choices | opzioni di risposta | |
| look up | cercare | |
| word or phrase | Parola o frase | |
| sign language | lingua dei segni | |
| audio transcript | Trascrizione audio / Trascrizione | |
| player (delivery shell) | player | the naturalized loanword; `lettore` reads as a media/DVD player |
| controller | controller | the naturalized dev loanword; `controllore` means inspector |
| database | database | naturalized, masculine |
| provider | fornitore | the Italian word, everywhere the provider is named in prose |
| payload | payload | the naturalized dev loanword |
| snapshot | istantanea | the Italian UI term |
| placement | posizionamento | |
| accommodation | adattamento | the Italian assessment-adaptation word in policy prose |
| district | distretto scolastico | |
| test administration | somministrazione della prova | the INVALSI term for administering a test |
| policy | policy | the naturalized loanword in the dev panels |
| resize | ridimensionare | |
| clockwise / counterclockwise | in senso orario / in senso antiorario | |
| media | contenuto multimediale | the Italian register; the region is `area multimediale` |
| pixels | pixel | invariable |
| degrees | gradi | keep the `°` glyph |

## Gender and agreement

- Genderless enums take the unmarked masculine: `all` = Tutti, `none` =
  Nessuno. Never presume the referent's gender.
- Forms agree with the real grammatical subject: `(barrata)` agrees with
  `opzione`, `Valutata da un insegnante` with `risposta`, `locale`,
  `remota`, `predefinita del browser` with `voce`, `Migliore voce
  disponibile (automatica)` with `voce`.
- Article handling is checked against the real noun: `l'area multimediale`,
  `lo strumento`, `gli strumenti`, `dell'API`, `all'interno di una cornice`.
- Colour highlights are nouns agreeing with `evidenziazione` (feminine):
  `Evidenziazione gialla`, `Evidenziazione rosa`, `Evidenziazione blu`
  (invariable), `Evidenziazione verde`.
- The annotation strip's live-region announcements cannot presume the
  interpolated span's gender, so the participle agrees with an explicit
  `Testo` subject and the colour stays adverbial: `Testo «{text}» evidenziato
  in giallo`, `Testo «{text}» sottolineato`. Removal and clearing agree with
  their own nouns: `Annotazione rimossa da «{text}»`, `{count} annotazione
  cancellata` / `{count} annotazioni cancellate`. The `«{text}»` span keeps
  the caporali, and `Shift+F10` stays Latin.
- The instrumentation kinds (`all`, `event`, `error`, `metric`,
  `user-context`, `global-attributes`) and the session-db field names
  (`assessmentId:` … `mode:`) stay verbatim identifiers; the debug detail
  labels translate lowercase like the English dev-panel register
  (`nome:`, `tipo:`, `fornitore:`), and the event-level values stay
  lowercase (`domanda`, `sezione`).

## Typography

- Quotation marks are the caporali « », the codified Italian convention,
  including around interpolated terms: `«{term}»`, `«{id}»`.
- No space before `%`; keep the `…` ellipsis and the `°` glyph.
- `È` and accented capitals are written with the grave accent (`È`), never
  an apostrophe.

## Untranslated product names

PIE, PNP, TTS (reserved for genuinely technical strings — the settings
panel itself is `Impostazioni della lettura ad alta voce`), SSML, WaveNet,
Studio, Desmos, Polly, AWS, Google Cloud TTS, Web Speech API, HTTP, JSON,
API, MP3, OGG, PCM, Hz. Signed-language names translate (`Lingua dei segni
americana`).

## Keyboard key names

A11y keys keep the Latin key names Italian keyboards print: `Shift`,
`PageUp`, `PageDown`, `Escape`, `+/-`, `U`. Arrow keys translate
(`tasti freccia`), since that is what Italian instructions say.

## Plurals, punctuation

- CLDR `one`/`many`/`other`: `many` is the cardinal category Italian
  defines for million-scale numbers (`un milione`). It carries the same
  text as `other`; it exists so the catalog matches what
  `Intl.PluralRules` can return for the locale. All six plural groups
  (`player.formative.triesLeft`, `tools.dictionary.entriesCount`,
  `tools.pictureDictionary.entriesCount`, `debug.tts.browserAvailable`,
  `debug.tts.pollyAvailable`, `debug.tts.googleAvailable`) carry all three
  categories with the `{count}` placeholder.
