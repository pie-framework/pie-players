# Portuguese (pt) brief

Serves every Portuguese host: registered under the bare `pt` tag, so `pt`,
`pt-BR` and `pt-PT` all widen to it. Content flavour is **Brazilian
Portuguese**, the register of Brazilian edtech and international schools.

## Register

- Controls carry the impersonal infinitive, standard in Brazilian UI:
  `Fechar`, `Buscar`, `Verificar resposta`.
- Sentences prefer impersonal phrasing (`Não foi possível…`); possessives
  use `sua` where unavoidable (`Suas respostas salvas…`).
- State-change announcements (a calculator opening, a tool moving or
  rotating) take the impersonal event form — `A calculadora básica foi
  aberta`, `Deslocamento para cima até {position}`, `Rotação para {degrees}
  graus` — never a bare gendered participle (`Calculadora básica aberta`,
  `Movido…`), which reads as a state and genders the tool.
- Whole sentences authored whole; no fragment assembly.

## Gender

- Genderless enums take the unmarked masculine: `all` = Todos, `none` =
  Nenhum. Never presume the referent's gender.
- Where a form agrees with a fixed grammatical subject, it follows that
  subject: `(riscada)` agrees with `alternativa`, `foi fechada` agrees with
  `a calculadora`.

## Terminology

| English | Portuguese | Note |
| --- | --- | --- |
| question | pergunta | questions = perguntas; learner regions show perguntas |
| passage | texto | a reading passage |
| section | seção | |
| assessment | avaliação | `loadFailed`, dictionary `notConfigured`, `showAssessmentRequest` |
| toolkit (the package, in prose) | conjunto de ferramentas | never the loanword `toolkit`; code identifiers (`assessment`, `updateAssessment(...)`, `requiredTools`) stay verbatim |
| submit | Entregar | assessment register |
| finish | Finalizar | |
| check answer | Verificar resposta | |
| tries left | tentativa(s) | `Resta {count} tentativa. / Restam {count} tentativas.` |
| settings | Configurações | |
| tools / toolbar | ferramentas / barra de ferramentas | |
| calculator | Calculadora | básica, científica, gráfica |
| graph | Gráfico | |
| coordinate plane | plano cartesiano | Brazilian math register |
| grid | grade | |
| line (mode) | Reta | the math object |
| periodic table | Tabela periódica | sentence case, like every pt-BR label |
| metalloid | Semimetal | the Brazilian chemistry term |
| atomic number | Número atômico | spelled out for screen readers; sentence-internal field labels lowercase (`número atômico:`) |
| ruler | Régua | |
| inches / centimeters | Polegadas / Centímetros | |
| protractor | Transferidor | the school instrument |
| dictionary | Dicionário | |
| picture dictionary | Dicionário de imagens | |
| entry (dictionary) | entrada | `{count} entradas`; a miss is singular: `Nenhuma entrada para…` |
| Spanish (language name) | espanhol | `Dicionário em espanhol` |
| line reader | Leitor de linhas | |
| magnifier | Lupa | |
| zoom in / out | Ampliar / Reduzir | |
| highlight(er) | Marca-texto / Realçar | Brazilian term for the pen |
| underline | Sublinhar | |
| annotate | Anotar | |
| theme | Tema | |
| text to speech | Ler em voz alta | read-aloud phrasing |
| playback speed | Velocidade de leitura | |
| rewind | Retroceder | the media-control verb; `Voltar` reads as navigation |
| sign language | Língua de sinais | |
| audio transcript | Transcrição de áudio | |
| strike through | Riscar | the answer-eliminator action |
| pixels | pixels | |
| degrees | graus | keep the `°` glyph |
| voice (TTS) | voz | |

## Vocabulary pins

- The gas phase value is the noun `Gas`, like Sólido and Líquido, not the
  adjective `Gasoso`.
- Toggle states read `Ativado`/`Desativado`; `Desligado` is a powered-off
  device, not a UI state.
- Eye strain in the theme hint is `fadiga visual`, the standard pt-BR term,
  not `cansaço visual`.

## Untranslated product names

PIE, PNP, TTS, SSML, WaveNet, Studio, Desmos, Polly, AWS, Google Cloud TTS,
Web Speech API, HTTP, JSON, API.

## Plurals, punctuation

- CLDR `one`/`many`/`other`: `many` is a cardinal category current CLDR
  defines for Portuguese (million-scale numbers). It carries the same text
  as `other`; it exists so the catalog matches what `Intl.PluralRules`
  can return for the locale.
- Keep `…`, curly quotes and the `°` glyph.
