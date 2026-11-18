# Dictionary Languages And Services

A dictionary lookup crosses two boundaries this repository does not own: which service
answers, and which language it answers in. The packaged panels
(`pie-tool-dictionary`, `pie-tool-picture-dictionary`) leave the first to the host and
resolve the second through the capability. This design record states the endpoint
contract a host implements and the reasons each boundary sits where it does.

## Endpoint contract

Each panel POSTs to one host-named endpoint and reads the results back:

| Body | Shape |
|---|---|
| Request, both panels | `{ keyword, language?, max? }` |
| Dictionary response | `{ entries: [{ word, pronunciation?, senses: [{ definition, partOfSpeech?, example? }] }] }` |
| Picture dictionary response | `{ pictures: [{ url, caption?, width?, height? }] }` (`images` is read as well) |

The request carries the session cookie by default, because the route sits behind the
same session boundary as the assessment. Unknown response fields are ignored. A
dictionary entry with no definition is dropped, and a picture `url` must be `https:`,
protocol-relative or same-origin.

[Backend endpoints for tool providers](./tool_host_contract.md#backend-endpoints-for-tool-providers)
sets the security obligations the route must meet.

## Service selection

Service selection is host-side. A deployment whose languages sit behind different
services dispatches on `language` in its own route; nothing in the framework needs to
know that more than one backend exists.

Deployments differ in ways a package cannot anticipate. One known dictionary fronts two
corpora behind a single host, path-selected by language: one answers its own payload, the
other proxies an upstream dictionary API's verbatim. Neither matches the panel's contract,
so the host route normalizes both, and that mapping, including how the upstream service
is authorized, lives with the host.

An endpoint-per-language map on the element was rejected: it would move that dispatch
into the package, where the panel would carry a service inventory it cannot validate,
while the host already knows its corpora.

### Credentials

A service credential never belongs to this package. Where the assessment host is the same
application that owns the dictionary, the lookup rides the learner's existing session and
no credential is provisioned for PIE at all. Where PIE hosts the delivery — a reference
app, a demo — its own server holds whatever the upstream requires and mints per-request
tokens there, so nothing reaches the browser and the panel calls a same-origin route.

The deployment shape decides who provisions the credential. Ask for a credential scoped
to the caller where it is cheap to provision. A shared platform credential is an accepted
way for services inside one organization to authenticate each other, and the teams that
own both ends decide whether it suits a deployment. The specifics — which secret, which
issuer, which host — live in the host's repository.

## Lookup language

The language of a definition belongs to the learner. `toolbarContext.language` is the
content-alternate language, the authored alternate the catalog resolver selects, and the
base `dictionary` and `pictureDictionary` capabilities pass it as the lookup language. A
section authored in English offers an English dictionary and a Spanish section a Spanish
one, which serves the reader who wants a definition in the language they are already
reading.

Content language misses the learner who needs a Spanish gloss while reading an English
passage. Delivery systems that offer both expose the English and Spanish dictionaries as
two separate tools, tabbed in one modal, for that reason. A single capability whose
language follows the content cannot express it: its support id is one grant.

### Capability per language

One capability per language ships, each with its own grant in the learner's Personal
Needs Profile (PNP), which is how the accommodation is authorized. A program grants a
Spanish dictionary to a learner independently of an English one, and a toolbar showing
two buttons shows two granted supports.

`dictionarySpanish` and `pictureDictionarySpanish` are in the packaged set. A support id is
the tool id it grants, so neither grant implies the base capability's. Each renders
the same element as the capability it varies; two capability ids, one panel
implementation.

A variant carries its corpus language rather than taking it from the host, and that
language outranks the toolbar's content-alternate language: the learner who needs a
Spanish gloss is reading an English passage, so a variant that followed the content would
be indistinguishable from the base capability on exactly the content it exists for. A
language the host names in the tool's render params still wins over both.

Another language is `createDictionaryToolRegistration` or
`createPictureDictionaryToolRegistration` with a `toolId` and a `lookupLanguage`,
registered on the tool registry the host passes to its coordinator.
Catalog keys derive from the capability id; a host with its own catalog passes
`messageKeyPrefix`, and a key that does not resolve falls back to the registration's
literal name, so a missing key is a plain label rather than a broken button.

### Rejected alternative: in-panel language selector

The alternative kept one capability and added a `languages` param, a selector inside the
panel and its own interface strings: for the learner, the tabbed modal other delivery
systems ship.

It was rejected for its cost to the grant. One capability is one PNP support, so a program
could no longer grant Spanish without granting English, and the panel would carry
knowledge of which corpora a deployment has. It is open to revisiting only for a program
that requires a single toolbar button.

## Synonyms (proposed)

`DictionarySense` carries `definition`, `partOfSpeech` and `example`. At least one
dictionary service PIE is deployed against returns synonyms, and its own delivery system
renders them as chips, so PIE discards content the service already returns. An optional
`synonyms?: string[]` on the sense, rendered under the definition, is additive: a host
payload that omits it reads exactly as it does now.
