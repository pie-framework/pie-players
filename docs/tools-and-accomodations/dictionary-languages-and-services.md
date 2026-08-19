# Dictionary Languages And Services

A dictionary lookup crosses two boundaries this repository does not own: which service
answers, and which language it answers in. The packaged panels
(`pie-tool-dictionary`, `pie-tool-picture-dictionary`) leave the first to the host and
resolve the second through the capability, and this note records why each sits where it
does.

## Service selection is host-side, by design

The panel POSTs `{ keyword, language?, max? }` to one host-named endpoint and reads
`{ entries: [{ word, senses }] }` back. A deployment whose languages sit behind different
services dispatches on `language` in its own route; nothing in the framework needs to
know that more than one backend exists.

A real deployment shows why the seam sits there. One assessment vendor's dictionary
fronts two corpora behind a single host, path-selected by language, each answering a
different payload — one the vendor's own shape, the other an upstream dictionary API's,
proxied verbatim. Neither is this panel's contract, so the host route normalises both. A
reference implementation of that mapping, including how the upstream service is
authorised, lives with the host rather than here; in Renaissance's case that is
`pie-api-aws`, whose PIEOneer container carries it.

An endpoint-per-language map on the element would move that dispatch into the package
and buy nothing: the host already knows its corpora, and the panel would then need to
carry a service inventory it cannot validate.

### Credentials are the host's

A service credential never belongs to this package. Where the assessment host is the same
application that owns the dictionary, the lookup rides the learner's existing session and
no credential is provisioned for PIE at all. Where PIE hosts the delivery — a reference
app, a demo — its own server holds whatever the upstream requires and mints per-request
tokens there, so nothing reaches the browser and the panel calls a same-origin route.

The distinction decides who has to ask for what, which is the only reason it appears in a
framework note. A credential scoped to the caller is the tidier arrangement and worth
asking for where it is cheap to provision; a shared platform credential is a normal way for
services inside one organisation to authenticate each other, and whether it suits a given
deployment is for the teams that own both ends to settle. Either way the specifics — which
secret, which issuer, which host — belong in the host's own repository rather than this
one.

## The language belongs to the learner

`toolbarContext.language` is the content-alternate language — which authored alternate the
catalog resolver selects — and the base `dictionary` and `pictureDictionary` capabilities
pass it as the lookup language. So a section authored in English offers an English
dictionary, and a Spanish section a Spanish one, which is right for the reader who wants a
definition in the language they are already reading.

It is not enough on its own. The learner who needs a Spanish gloss is reading an English
passage: the language of a definition is a property of the learner, not of the content.
SchoolCity exposes English Dictionary and Spanish Dictionary as two separate tools, tabbed
in one modal, for exactly that reason. A single capability whose language follows the
content cannot express it, and its four support ids — `dictionary`, `englishDictionary`,
`glossary`, `definitions` — are four names for one grant.

### Capability per language

This is what ships. One capability per language, each with its own PNP grant, which is
how the accommodation is authorised: a programme grants a Spanish dictionary to a learner
independently of whether an English one is granted, and a toolbar showing two buttons is
showing two granted supports.

`dictionarySpanish` and `pictureDictionarySpanish` are in the packaged set, claiming
`spanishDictionary` / `spanishPictureDictionary` and their glossary variants — no support
id is shared with the base capabilities, so neither grant implies the other. Each renders
the same element as the capability it varies; two capability ids, one panel
implementation.

A variant carries its corpus language rather than taking it from the host, and that
language outranks the toolbar's content-alternate language: the learner who needs a
Spanish gloss is reading an English passage, so a variant that followed the content would
be indistinguishable from the base capability on exactly the content it exists for. A
language the host names in the tool's render params still wins over both.

Another language is `createDictionaryToolRegistration` or
`createPictureDictionaryToolRegistration` with a `toolId`, its own `pnpSupportIds` and a
`lookupLanguage`, registered through the `configureToolRegistry` hook a host already has.
Catalogue keys derive from the capability id; a host with its own catalogue passes
`messageKeyPrefix`, and a key that does not resolve falls back to the registration's
literal name, so a missing key is a plain label rather than a broken button.

### Language selector in the panel, not taken

The alternative kept one capability and added a `languages` param, a selector inside the
panel and its own interface strings — for the learner, the tabbed modal other delivery
systems ship.

The trade was in the grant, not the UI: one capability is one PNP support, so a programme
could no longer grant Spanish without granting English, and the panel would carry
knowledge of which corpora a deployment has. Worth revisiting only for a programme that
requires a single toolbar button.

## Synonyms

`DictionarySense` carries `definition`, `partOfSpeech` and `example`. SchoolCity's
service returns synonyms on both routes and its own modal renders them as chips, so PIE
currently discards content the service already paid for. An optional
`synonyms?: string[]` on the sense, rendered under the definition, is additive: a host
payload that omits it reads exactly as it does now.
