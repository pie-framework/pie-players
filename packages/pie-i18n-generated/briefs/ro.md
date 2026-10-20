# Romanian (ro) brief

Serves every Romanian host: registered under the bare `ro` tag, so `ro`,
`ro-RO` and `ro-MD` all widen to it. Content flavour is **standard Romanian
as written in Romania**, which Moldovan schools read without friction; a host
wanting Moldovan vocabulary overrides per key through `customMessages`.

## Register

- Controls carry the imperative, second person singular, the convention in
  Romanian consumer and classroom software and the form a learner is addressed
  in: `Închide`, `Salvează`, `Verifică răspunsul`, `Încearcă din nou`.
- Sentences address the learner as `tu` where a possessive is unavoidable
  (`Răspunsurile tale salvate…`); otherwise impersonal (`Nu a putut fi
  încărcat…`).
- Comma-below diacritics throughout (`ș`, `ț` — U+0219, U+021B), never the
  cedilla forms. Romanian quotation marks „…” replace English curly quotes.
- Whole sentences authored whole; no fragment assembly.

## Terminology

| English | Romanian | Note |
| --- | --- | --- |
| question | întrebare | questions = întrebări |
| passage | text | a reading passage |
| item | item | the assessment loanword, plural `itemi` |
| section | secțiune | |
| assessment | evaluare | |
| submit | Trimite | online-testing register |
| finish | Finalizează | |
| check answer | Verifică răspunsul | |
| tries left | încercare / încercări rămase | three CLDR forms; see below |
| settings | Setări | |
| tools / toolbar | instrumente / bara de instrumente | |
| calculator | Calculator | simplu, științific, grafic |
| graph | Grafic | |
| coordinate plane | plan de coordonate | |
| grid | grilă | |
| line (mode) | Dreaptă | the math object |
| periodic table | Tabelul periodic | |
| metalloid | Metaloid | |
| atomic number | Număr atomic | spelled out for screen readers |
| ruler | Riglă | |
| inches / centimeters | Inchi / Centimetri | |
| protractor | Raportor | the school instrument |
| dictionary | Dicționar | |
| picture dictionary | Dicționar ilustrat | |
| entry (dictionary) | intrare | `{count} intrări`, `{count} de intrări` |
| Spanish (language name) | spaniolă | `Dicționar spaniol` |
| line reader | Ghid de citire | |
| magnifier | Lupă | |
| zoom in / out | Mărește / Micșorează | |
| highlight(er) | Evidențiere / Evidențiază | |
| underline | Subliniază | |
| annotate | Adnotează | |
| theme | Temă | |
| text to speech | Citire cu voce tare | read-aloud phrasing |
| playback speed | Viteză de redare | |
| sign language | Limba semnelor | `Limba semnelor americană`, per the 2020 recognition of LSR |
| audio transcript | Transcriere audio | |
| strike through | Tăiere / Taie | the answer-eliminator action |
| teacher | profesor | |
| pixels | pixeli | |
| degrees | grade | keep the `°` glyph |
| voice (TTS) | voce | |

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API.

## Plurals, numbers, punctuation

- CLDR `one` / `few` / `other`. `few` covers 0 and 2–19 (and 102–119 …);
  `other` starts at 20 and takes the preposition `de` before the noun:
  `1 încercare`, `3 încercări`, `20 de încercări`. Every plural group carries
  all three.
- Arabic numerals, comma decimal separator; `Intl` handles both.
- Keep `…`, the `°` and `×` glyphs.
