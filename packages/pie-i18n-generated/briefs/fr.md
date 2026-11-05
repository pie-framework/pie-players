# French (fr) brief

Serves every French host: registered under the bare `fr` tag, so `fr`,
`fr-FR` and `fr-CA` all widen to it. Content flavour is standard
international/France French; a Canadian host can override per key.

## Register

- Controls carry the impersonal infinitive, the French UI convention:
  `Fermer`, `Rechercher`, `Vérifier la réponse`.
- Sentences prefer impersonal or `vous`-free phrasing; possessives use
  `votre` only where unavoidable (`Vos réponses enregistrées…`).
- State-change announcements (a calculator opening, a tool moving or
  rotating) take the event-noun form — `Ouverture de la calculatrice
  basique`, `Déplacement vers le haut à {position}`, `Rotation à {degrees}
  degrés`, `Passage à l'unité {unit}` — never a participle (`Déplacé…`,
  `Calculatrice basique ouverte`), which reads as a state and genders the
  tool. Announcements about the read-aloud playback state the subject and
  agree with it: `Lecture avancée`, `Lecture rembobinée`.
- Whole sentences authored whole; no fragment assembly.

## Gender

- Genderless enums take the unmarked masculine: `all` = Tous, `none` =
  Aucun. Never presume the referent's gender.
- Where a form agrees with a fixed grammatical subject, it follows that
  subject: `(barrée)` agrees with `option`, `Lecture rembobinée` agrees with
  `lecture`.

## Terminology

| English | French | Note |
| --- | --- | --- |
| question | question | a delivered question |
| items | questions | learner-facing regions show questions |
| passage | texte | a reading passage |
| section | partie | French assessments use parties |
| assessment | évaluation | the French education word, not `test` — `loadFailed`, `toolsA11y`, dictionary `notConfigured` |
| toolkit (the package, in prose) | boîte à outils | never the loanword `toolkit`; code identifiers (`assessment`, `updateAssessment(...)`, `requiredTools`) stay verbatim |
| submit | Valider | |
| finish | Terminer | |
| check answer | Vérifier la réponse | |
| tries left | tentative(s) | `Il reste {count} tentative(s).` |
| settings | Paramètres | |
| tools / toolbar | outils / barre d'outils | |
| calculator | Calculatrice | basique, scientifique, graphique |
| graph | Graphique | |
| coordinate plane | repère cartésien | French math register |
| grid | Quadrillage | |
| line (mode) | Droite | the math object, not `ligne` |
| periodic table | Tableau périodique | |
| post-transition metal | Métal pauvre | the French chemistry term |
| atomic number | Numéro atomique | spelled out for screen readers |
| ruler | Règle | |
| inches / centimeters | Pouces / Centimètres | |
| protractor | Rapporteur | the school instrument |
| dictionary | Dictionnaire | |
| picture dictionary | Dictionnaire en images | |
| entry (dictionary) | entrée | `{count} entrées`; a miss is singular: `Aucune entrée pour…` |
| Spanish (language name) | espagnol | `Dictionnaire en espagnol` |
| line reader | Aide à la lecture | the reading-guide tool |
| magnifier | Loupe | |
| zoom in / out | Zoom avant / Zoom arrière | |
| highlight(er) | Surligneur / Surligner | |
| underline | Souligner | |
| annotate | Annoter | |
| theme | Thème | |
| text to speech | Lecture à voix haute | read-aloud phrasing |
| playback speed | Vitesse de lecture | |
| sign language | Langue des signes | |
| audio transcript | Transcription audio | |
| strike through | Barrer | the answer-eliminator action |
| pixels | pixels | |
| degrees | degrés | keep the `°` glyph |
| voice (TTS) | voix | |
| speech marks | marques de parole | |
| database table | table | `tables brutes`, not `tableaux` — the DB object, not the chart |

## Typography

- NBSP before `:` `!` `?` and inside `«»`, per French convention.
- Curly quotes are replaced by French guillemets `«{term}»`; `…` kept.
  Interpolated identifiers take them too: `«\u00A0{id}\u00A0»`.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API. Signed-language names translate
(`Langue des signes américaine`).

## Plurals, punctuation

- CLDR `one`/`many`/`other`: `many` is a cardinal category current CLDR
  defines for French (million-scale numbers, like Portuguese). It carries
  the same text as `other`; it exists so the catalog matches what
  `Intl.PluralRules` can return for the locale.
- Keep the `…` ellipsis and the `°` glyph.
