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
- Tool-move announcements take the event-noun form — `Mutare în sus la
  {position}`, `Rotire la {degrees}°` — never a bare participle (`Mutat…`),
  which genders the moved tool. Where a sentence states its subject, the
  participle agrees with it: `Calculatorul simplu a fost deschis`, `S-a
  comutat la {unit}`.
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
| atomic number | Număr atomic | spelled out for screen readers; sentence-internal field labels lowercase (`număr atomic:`) |
| ruler | Riglă | |
| inches / centimeters | Inchi / Centimetri | |
| protractor | Raportor | the school instrument |
| dictionary | Dicționar | |
| picture dictionary | Dicționar ilustrat | Spanish variant is `Dicționar ilustrat în spaniolă`, matching the `în spaniolă` pattern |
| entry (dictionary) | intrare | `{count} intrări`, `{count} de intrări`; a miss is singular: `Nicio intrare pentru…` |
| Spanish (language name) | spaniolă | `Dicționar spaniol` |
| line reader | Ghid de citire | its frame `maschează` the rest of the content, it does not merely `acoperi` it |
| magnifier | Lupă | |
| zoom in / out | Mărește / Micșorează | |
| highlight(er) | Evidențiator / Evidențiază | the pen, like es `Resaltador`, fr `Surligneur`, pt `Marca-texto`; the action is `Evidențiază` |
| underline | Subliniază | |
| annotate | Adnotează | |
| theme | Temă | |
| text to speech | Citire cu voce tare | read-aloud phrasing |
| playback speed | Viteză de redare | |
| rewind | Derulează înapoi | the media-control verb; `Înapoi` reads as navigation |
| sign language | Limba semnelor | `Limba semnelor americană`, per the 2020 recognition of LSR |
| audio transcript | Transcriere audio | |
| strike through | Barează | from `a bareza`, the school word for crossing an answer out; `Tăiere/Taie` reads as cut-and-paste. The category value agrees with `categorie`: `Necunoscută` |
| teacher | profesor | |
| pixels | pixeli | |
| degrees | grade | keep the `°` glyph |
| voice (TTS) | voce | |
| browser speech synthesis | sinteza vocală din browser | `Citirea cu voce tare din browser` named a different thing than `Sinteza vocală`; the panel speaks one term |

## Vocabulary pins

- `autorat` is a false friend — it reads as "authorized" (`a autoriza`).
  Authored content is `conținutul creat`; the preserved preview markup is
  `SSML-ul original`.
- Genderless enums keep the inanimate defaults `Toate` / `Niciuna`, the forms
  Romanian software shows for filters; the unmarked-masculine rule is a
  Spanish/Romanian-animate convention, not a Romanian one.

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
