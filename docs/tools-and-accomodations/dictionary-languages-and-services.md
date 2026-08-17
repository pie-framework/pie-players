# Dictionary Languages And Services

A dictionary lookup crosses two boundaries this repository does not own: which service
answers, and which language it answers in. The packaged panels
(`pie-tool-dictionary`, `pie-tool-picture-dictionary`) settle the first and only half of
the second, and the gap is the subject of this note.

## Service selection is host-side, by design

The panel POSTs `{ keyword, language?, max? }` to one host-named endpoint and reads
`{ entries: [{ word, senses }] }` back. A deployment whose languages sit behind different
services dispatches on `language` in its own route; nothing in the framework needs to
know that more than one backend exists.

SchoolCity is that case and is the proof. `sc-dictionary-api` fronts two backends on one
host: `/en` reads SchoolCity's own corpus and answers
`{ statusCode, words: [{ partOfSpeech, definition, examples, synonyms }] }`, while `/es`
proxies Oxford and answers Oxford's
`{ metadata, results: [{ lexicalEntries: [{ lexicalCategory, entries: [{ senses }] }] }] }`.
Both are normalised in `pie-api-aws` — `containers/pieoneer/src/lib/server/dictionary/schoolCityDictionary.ts` —
where the service's JWT is also minted, so the shared secret never reaches a browser and
the panel calls a same-origin route on the assessment's own session.

An endpoint-per-language map on the element would move that dispatch into the package
and buy nothing: the host already knows its corpora, and the panel would then need to
carry a service inventory it cannot validate.

### Credentials are the host's, and whose host matters

In SchoolCity-delivered assessment the host is SchoolCity's own application: it points the
panel at its own route, authorised by the learner's session, and PIE holds no service
credential at all. The `pie-api-aws` route exists for PIE-hosted contexts — pieoneer and
the demos — and it is there that a credential question arises.

`sc-dictionary-api` validates one shared secret, and SchoolCity's platform signs service
calls with a single key (`ServiceAuthkey`, verified elsewhere as `JWT_SHARED_SECRET`),
which is why their client forwards a session token rather than a dictionary-specific one.
A PIE-hosted deployment must not be given that key: it authorises every SchoolCity
service, not a lookup. The ask is a PIE-scoped issuer and secret, which
`sc-texttospeech-api` already provisions through an issuer-to-secret map and the
dictionary service currently does not. Measured: a token signed with PIE's TTS secret is
refused by both the dev and production dictionary hosts with `401 Invalid or expired
JWT`, so the two services do not share a credential today.

## One capability, one language at a time

`toolbarContext.language` is the content-alternate language — which authored alternate
the catalog resolver selects — and the dictionary registration passes it as the lookup
language unless a host overrides it per tool through the render params. So a section
authored in English offers an English dictionary, and a Spanish section a Spanish one.

That is the wrong shape for the accommodation. SchoolCity exposes English Dictionary and
Spanish Dictionary as two separate tools, tabbed in one modal, because the learner who
needs a Spanish gloss is reading an English passage: the language of the definition is a
property of the learner, not of the content. PIE cannot express that today. There is one
`dictionary` capability, its `pnpSupportIds` are `dictionary`, `englishDictionary`,
`glossary` and `definitions` — four names for one grant — and no support id claims a
second language.

### Capability per language

Register one capability per language, each with its own PNP grant and its own render
params naming the language. This matches how the accommodation is authorised: a PNP
grants a Spanish dictionary to a learner, independently of whether an English one is
granted, and a toolbar that shows two buttons is showing two granted supports.

Three additions in this repository, all small:

- Export `dictionaryToolRegistration` and `pictureDictionaryToolRegistration` from
  `@pie-players/pie-default-tool-loaders`. Every other registration is already exported
  for exactly this purpose; these two are the omission.
- Make the dictionary registration a factory over `toolId`, `nameKey`,
  `descriptionKey` and `pnpSupportIds`, so a second language is a call rather than a
  hand-cloned object that drifts.
- Add a `spanishDictionary` support id and the catalogue keys for the second label, in
  all declared locales, since the coverage gate requires them.

A host then composes the extra capability through the `configureToolRegistry` hook it
already has, and points it at the same endpoint with `language: "es"`.

### Language selector in the panel

The alternative keeps one capability and adds a `languages` param naming what the host's
service serves, a selector inside the panel, and its own interface strings. For the
learner it is SchoolCity's tabbed modal.

The trade is in the grant, not the UI: one capability means one PNP support, so a
programme can no longer grant Spanish without granting English, and the panel starts
carrying knowledge of which corpora a deployment has. Take this only where a programme
requires a single toolbar button.

## Synonyms

`DictionarySense` carries `definition`, `partOfSpeech` and `example`. SchoolCity's
service returns synonyms on both routes and its own modal renders them as chips, so PIE
currently discards content the service already paid for. An optional
`synonyms?: string[]` on the sense, rendered under the definition, is additive: a host
payload that omits it reads exactly as it does now.
