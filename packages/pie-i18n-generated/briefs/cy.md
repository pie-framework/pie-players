# Welsh (cy) brief

Serves every Welsh host: registered under the bare `cy` tag, so `cy` and
`cy-GB` both widen to it. A host wanting a different flavour overrides per
key through `customMessages`.

## Register

- Controls carry the imperative, the Welsh UI convention: `Cau`,
  `Chwilio`, `Gwirio'r ateb`.
- Sentences prefer impersonal or implied-subject phrasing (`Methwyd â
  llwytho…`), with `eich` possessives only where English has "your".
- Whole sentences authored whole; no fragment assembly.

## Terminology

Terminology follows Welsh-medium education usage; school instruments use
the forms Welsh-medium GCSE papers use (Y Termiadur Addysg where it names
one).

| English | Welsh | Note |
| --- | --- | --- |
| question | cwestiwn | a delivered question |
| items | cwestiynau | learner-facing regions show questions |
| passage | testun | a reading passage |
| section | adran | Welsh assessments use adrannau |
| assessment | asesiad | |
| submit | Cyflwyno | |
| finish | Gorffen | |
| check answer | Gwirio'r ateb | |
| tries left | ceisiad / ceisiadau | `{count} geisiad ar ôl.` / `{count} o geisiadau ar ôl.` |
| settings | Gosodiadau | |
| tools / toolbar | offer / bar offer | |
| calculator | Cyfrifiannell | Sylfaenol, Wyddonol, Graffu |
| graph | Graff | |
| coordinate plane | plân cartesaidd | Welsh math register |
| grid | grid | |
| line (mode) | Llinell | |
| periodic table | Tabl Cyfnodol | |
| noble gas | Nwy Gennud | the Welsh chemistry term |
| post-transition metal | Metel Ôl-drosiannol | |
| atomic number | Rhif Atomig | spelled out for screen readers |
| ruler | Rholer | the school instrument |
| inches / centimeters | modfeddi / centimetrau | |
| protractor | Protractwr | the school instrument |
| dictionary | Geiriadur | |
| picture dictionary | Geiriadur Lluniau | |
| entry (dictionary) | cofnod | `{count} o gofnodion` |
| Spanish (language name) | Sbaeneg | `Geiriadur Sbaeneg` |
| line reader | Canllaw Darllen | the reading-guide tool |
| magnifier | Chwyddwydr | magnifying glass |
| zoom in / out | Chwyddo i mewn / Chwyddo allan | |
| highlight(er) | Amlygu / Amlygydd | |
| underline | Tanlinellu | |
| annotate | Anodi | |
| strike through | Taro Trwodd | the answer-eliminator action |
| theme | Themâ | circumflex spelling |
| text to speech | Llefaru | speech-output phrasing |
| playback speed | Cyflymder chwarae | |
| sign language | Iaith Arwyddion | |
| audio transcript | Trawsgrifiad Sain | |
| pixels | picsel | invariant after numerals |
| degrees | graddau | keep the `°` glyph |
| voice (TTS) | llais | |
| speech marks | marciau lleferydd | |

## Numerals and mutation

- Singular noun after 1–6 (`{count} geisiad`), `o` + plural otherwise
  (`{count} o geisiadau`), which is the standard Welsh UI pattern for
  numeric placeholders.
- Soft mutation after `dau` (`{count} gofnod`, `{count} ddelwedd`) is
  authored where the pattern is fixed; machine output elsewhere may miss
  mutations — a review pass should check them first.

## Typography

- Curly quotes `“{term}”` as in English; `…` kept.
- The circumflex in `Themâ`, `ffrâm` is standard.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API, MP3, OGG, PCM. Signed-language names
translate (`Iaith Arwyddion America`).
