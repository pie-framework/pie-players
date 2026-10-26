# Language Variants

Status: Ready, 2026-10-25

Implementation status: pie-players landed the fields, the interchange types,
`negotiateContentLanguage` with its conformance fixtures, the item player's
`requestedLanguages` and `identity`, per-item `env.locale` in the section player
and the `itemTranslation` tool parameter (#867, #870). Outstanding in
pie-players: the section player reading the item player's served identity, and
`keyword-translation` card languages. pie-api-aws landed a read-adapter seam with
no language derivations; derived fields, variant resolution, the player endpoint
fields and session recording are outstanding.
No authoring tool emits `language` or `isAdaptationOf` yet.

Owner: PIE Players maintainers

This PRD sets the contract for serving one item or passage in several languages:
what content declares, what a host requests, what a backend resolves and reports,
and what the players do with the result. It is for maintainers of players-shared,
the item and section players, and backends that serve PIE content.

Related architecture:

- [Content model](../architecture/content-model.md#language-variants)
- [Internationalization](../architecture/internationalization.md#content-language)
- [Item player backend support](../item-player/backend-support.md)
- [Consumer API dependencies](../integrations/consumer-api-dependencies.md)

## Problem

A translated item is authored, reviewed and calibrated as its own item, so its
score is only comparable when the learner is served that exact version and the
session records which one it was. Before this contract no PIE type named an
item's language or its source, so a host offering Spanish had to pick versions
by backend-specific metadata, a section could carry only one `env.locale`, and
scoring ran under whatever locale the host passed.

## Goals

- Content declares its language and, for a translation, the source it was
  adapted from.
- A host requests languages in preference order; a backend serves one variant
  per item and names it.
- The served language governs rendering, read-aloud, model, save and score for
  that item alone, so one section may mix languages.
- Every backend that negotiates languages picks the same variant for the same
  inputs.
- The session records the served variant, so a score is traceable to it.

## Non-Goals

- Runtime machine translation, or a player swapping content between variants.
- Per-choice or per-node language selection inside an item.
- `keyword-translation` and glossary cards; rollout item 5 of
  [Internationalization](../architecture/internationalization.md#rollout) owns
  them.
- Interface locale: [`interface-i18n-host-provider.md`](./interface-i18n-host-provider.md)
  owns chrome strings.
- How a backend stores, indexes or derives the fields.

## Package And Export Ownership

- Owning package: `@pie-players/pie-players-shared`.
- Public export paths: `./types` (`ItemEntity.language`,
  `ItemEntity.isAdaptationOf`, the same on `PassageEntity`,
  `AssessmentEntity.languagePolicy`, and `AdaptationLink`, `LanguagePolicy`,
  `ContentSubstitution`, `ServedContentIdentity`); `./i18n/language-tags`
  (`negotiateContentLanguage`, Node-safe).
- Consuming packages: item player (built-in delivery), section player,
  assessment toolkit, default tool loaders.
- Runtime environment: types and negotiation are Node-safe; delivery is browser.

## Contract Shape

Field semantics, the family rule and the policy live in
[Content model](../architecture/content-model.md#language-variants); the wire
shape lives in [backend support](../item-player/backend-support.md). This
section fixes the obligations on each party.

**Content.** A variant is a stored item or passage version with `language`
(BCP 47). A translation adds `isAdaptationOf: { baseId, version? }`; `version`
is absent when provenance is unknown. The family key is
`isAdaptationOf.baseId ?? baseId`.

**Host.** A host sends `requestedLanguages` in the learner's preference order,
taken from the PNP's `item-translation` through the `itemTranslation` tool
parameter. Absent or empty, the request is today's request.

**Backend.** A backend that serves variants:

- negotiates with the semantics of `negotiateContentLanguage` and passes the
  conformance fixtures in
  `packages/players-shared/tests/content-language-fixtures.json` unchanged;
- resolves per item, with items that share a passage resolved together so the
  passage renders in one language;
- applies the assessment's `LanguagePolicy`; a request may narrow the policy and
  never widen it;
- returns `identity` naming the served `baseId`, `version`, `family`,
  `servedLanguage` and any `substitution`;
- scores a server-side score under `servedLanguage`;
- records `requestedLanguages` and the returned identity on the session, and
  pins the served version as it pins any other;
- fails the load under `fallback: "none"` with an error that names the family
  and the missing language.

**Players.** The item player renders, saves and scores under
`identity.servedLanguage` when present, else under the entity's `language`, else
under the host's `env.locale`. The section player narrows `env.locale` per item
and per passage from the entity's `language` and records
`content: { baseId, version, servedLanguage }` on the item session. Once it reads
the item player's served identity, it records `family` and `substitution` too.

## Compatibility

Every field is optional and every behaviour is opt-in: content without
`language` keeps the section's `env`, and a request without `requestedLanguages`
is served as before. A backend that ignores `requestedLanguages` and returns no
`identity` remains conformant for monolingual delivery. Elements still read
`model.language` for their own `lang` stamp; the served language reaches them
through `env.locale`.

## Data Ownership And Host Responsibilities

The backend owns the family, the resolution and the session record. The host
owns the learner's requested languages and the assessment policy it assigns.
Authoring tools own `language` and `isAdaptationOf`: a link records the source
version translated, and a variant whose source has a newer release is stale.
Players own nothing persistent.

## Serialization And Versioning

`language` is a base-level attribute: changing it does not create a new version.
`isAdaptationOf` is part of the version. QTI carries `language` as `xml:lang` and
the adaptation link as AfA PNP `isAdaptationOf`; pie-qti's mapping is
outstanding. The interchange types are semver-bound under the
[content extensions](./content-extensions.md#contract-shape) tiers.

## Accessibility

The served language is stamped as `lang` and `dir` on the content root, so
screen readers switch voice and right-to-left content lays out correctly per
item. Read-aloud picks its voice from the stamp
([TTS language](../architecture/internationalization.md#tts-language)). A
fallback substitution leaves the item in a language the learner did not
request; a host should tell the learner, and the identity carries what it needs
to.

## Standards Or Adapter Impact

AfA PNP 3.0 `item-translation` is the learner's request and `isAdaptationOf` the
adaptation link. QTI 3 `xml:lang` and `cpx:variant` map to `language` and the
family on import.

## Test Plan

- Unit: `negotiateContentLanguage` against the conformance fixtures, including
  script boundaries (`zh-TW` never reaches `zh-Hans`), `matching: "exact"`, the
  fallback chain and `null` for undeclared content.
- Item player: a load with `requestedLanguages` refetches on change, and a
  response `identity` sets `env.locale` for render, save and score.
- Section player: two items in different languages in one section stamp their
  own `lang` and read aloud in their own voice, through a formative reveal.
- Backend conformance: the backend runs the same fixtures; a load for `es-MX`
  against a family with `es` serves `es` with no substitution; `fr` serves the
  source with `substitution: "fallback"`; `fallback: "none"` fails the load; a
  section mixes languages while items sharing a passage stay together; the
  session records the identity.
- Reference host: a test surface lets a tester set requested languages per
  session or per page, see the family, the negotiation trace and the served
  identity, and compare in-browser negotiation with a backend's answer for the
  same inputs. A disagreement is a conformance failure.

## Rollout And Release Notes

1. Contract and players: released with the pending `language-variants` and
   `item-translation-parameter` changesets.
2. Backend read path: derived fields, resolution and endpoint fields, all off
   until a request names `requestedLanguages`.
3. Assessments opt in by `languagePolicy`.
4. Authoring tools emit `language` and `isAdaptationOf` on publish.

## Open Questions

- Whether the section player should surface a fallback substitution to the
  learner itself or leave it to the host.
