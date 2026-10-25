# Content Model

The fields of `ItemEntity`, `PassageEntity` and `AssessmentEntity` in
`@pie-players/pie-players-shared/types`, each with its contract tier, and the
language-variant model those fields carry.

The tiers are the ones the [content extensions PRD](../prds/content-extensions.md#contract-shape)
defines:

- **runtime**: a player or element reads the field to load, render or score.
  Behaviour, tested, semver-bound.
- **interchange**: a typed field with a meaning that players carry and never
  read. Name, shape and meaning are semver-bound.
- **backend**: a backend's storage, indexes and legacy keys. Never named in
  these types.

Fields no player reads and no interchange contract defines are listed as
**untiered**; the PRD's placement rule decides whether each stays.

## Items and passages

| Field | On | Tier | Meaning |
| --- | --- | --- | --- |
| `config` | both | runtime | Markup, element tags and models the player renders |
| `passage` | item | runtime | The item's passage, by id or inline; `null` means none |
| `accessibilityCatalogs` | both | runtime | Catalog cards owned by the item or passage root |
| `language` | both | runtime | BCP 47 tag of the content's language (QTI `xml:lang`); see [Language variants](#language-variants) |
| `name` | both | runtime | The section player's fallback when a passage has no `id` |
| `baseId`, `version` | both | interchange | The stored version. The section player records them, with `language`, as the item session's `content` |
| `isAdaptationOf` | both | interchange | The source a translation was adapted from: `{ baseId, version? }` |
| `signature` | both | untiered | A backend's content hash |
| `retired`, `published` | both | untiered | A backend's lifecycle flags |
| `configuration` | item | untiered | Authoring configuration |

A section's item reference may omit `baseId` and `version`
(`ReferencedItemEntity`, `ReferencedPassageEntity`): a host building a section
from an item config has no stored version.

## Assessments

| Field | Tier | Meaning |
| --- | --- | --- |
| `settings` | runtime | District policy, test administration and tool parameters the tool policy reads |
| `personalNeedsProfile` | runtime | The learner's PNP |
| `accessibilityCatalogs` | runtime | Catalog cards owned by the assessment |
| `testParts` | runtime | The QTI test structure the assessment player walks |
| `languagePolicy` | interchange | The languages the assessment is offered in; see [Language variants](#language-variants) |
| `name`, `title`, `identifier`, `description` | untiered | Display and identity metadata |
| `qtiVersion`, `contextDeclarations` | untiered | QTI 3.0 import metadata |

## Language variants

A language variant is its own item or passage version. It declares `language`
and, when it is a translation, `isAdaptationOf`. Its family is
`isAdaptationOf.baseId ?? baseId`, so a source and its translations share the
source's `baseId` as family key. Each variant is separately authored and
calibrated; no player swaps one for another at runtime.

**Delivery.** A backend resolves a family to one variant per request. The item
player's built-in delivery sends the learner's languages as
`requestedLanguages` and reads the served variant back as `identity`
(`ServedContentIdentity`: `baseId`, `version`, `family`, `servedLanguage`,
`substitution`); [backend support](../item-player/backend-support.md) has the
wire shape. A host takes the learner's language from the PNP's
`item-translation`, which the AfA mapping carries as the `itemTranslation` tool
parameter's `language`.

**Rendering and scoring.** An entity's `language` becomes `env.locale` for that
item or passage alone, so variants in different languages share a section. A
served language overrides it inside the item player, for rendering, model,
save and score calls alike. The player stamps it as `lang` and `dir` on the
content root, which read-aloud follows ([TTS language](./internationalization.md#tts-language)).
Content without `language` keeps the section's `env`.

**Policy.** `LanguagePolicy` on an assessment is read by the backend that
resolves variants:

- `languages`: the BCP 47 tags the assessment may be served in;
- `fallback`: `"default"` serves an item whose family lacks the requested
  language in the platform default, `en-US`, recording
  `substitution: "fallback"`; a family with no `en-US` member serves its
  source. Fallback is per item, so a section may mix languages, and items that
  share a passage fall back together so the passage renders in one language.
  `"none"` fails the load. Without a policy, fallback is `"default"`;
- `matching`: `"closest"`, the default, serves the nearest variant in the
  requested language, so `es-MX` is served `es` or `es-ES` when the family has
  no `es-MX`; `"exact"` serves only the requested tag and leaves the rest to
  `fallback`;
- `staleness`: `"serve"` serves a variant whose source has a newer release,
  recording `substitution: "stale"`; `"require-current"` treats it as missing.

**Language matching** is BCP 47 lookup that never crosses scripts:
`negotiateContentLanguage` in `@pie-players/pie-players-shared/i18n/language-tags`
walks `zh-TW → zh-Hant`, skips a bare `zh` held in another script, and then
widens to a sibling in the same language and script, `es-MX → es-ES`. Its
`matching` option applies the policy's `matching`. A backend
that negotiates on its own side matches the conformance fixtures in
`packages/players-shared/tests/content-language-fixtures.json`.

**Sessions.** The section player records an item session's `content` from the
entity's `language`; `family` and `substitution` reach a session only from a
backend's `identity`. The section player does not yet read the item player's
served identity, so in a section the recorded language is the declared one.
