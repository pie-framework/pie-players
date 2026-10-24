# Content Extensions And Metadata Tiers

Status: Ready, 2026-10-24

Implementation status: pie-players removed `SearchMetaData`, `SearchMetaDataEntity`
and the `searchMetaData` field from the five content entities in 82596926b, and
`highlights`, `SettingsMetaData`, `SettingsMetaDataEntity` and
`AssessmentSection.settings` after it; `extensions` is deferred until a pie-players
consumer exists. pie-qti still names the bag `searchMetaData` and
writes it under the `pie:searchMetaData:` LOM source; the rename is outstanding.

Owner: PIE Players maintainers

This PRD sets the contract tier of every metadata surface on PIE content, and
defines `extensions`, the open-source name for a host-owned key/value bag on items,
passages, assessments, sections and item references. It is for maintainers of
players-shared and pie-qti.

Related architecture:

- [Internationalization](../architecture/internationalization.md)
- [Framework-completing work](../architecture/framework-completing-work.md)
- [Consumer API dependencies](../integrations/consumer-api-dependencies.md)

## Problem

players-shared declared a backend's storage field, `searchMetaData`, as an
open-source type. The name promised search, which no open-source project performs,
and it gave hosts no rule for which keys belong in a free bag and which need a typed
field. Two more backend-tier fields remain in the same file: OpenSearch `highlights`
on `ItemEntity` and `PassageEntity`, and `SettingsMetaData` on `AssessmentSection`.
pie-qti round-trips the bag through QTI under the backend's name, with a guessed LOM
purpose that matches none of the keys in use.

## Goals

- Every metadata surface carries one tier, and the open-source types hold only
  runtime and interchange surfaces.
- One open-source name for a host-owned bag, with promises PIE can keep.
- A lossless QTI 3 round trip for the bag.
- A placement rule that says when a key leaves the bag for a typed field.

## Non-Goals

- Changing a backend's storage, indexes, query API or key names.
- A key registry, vocabulary, validation or namespace syntax.
- Typed fields for locale, adaptation, curriculum standards or skill levels. Their
  own designs define them; this PRD only routes their keys out of the bag.
- An item-level calculator field (see Standards Or Adapter Impact).
- QTI item-reference `category`. PIE scoring has no outcome processing that
  aggregates by it.

## Package And Export Ownership

- `@pie-players/pie-players-shared` owns the content entity types. It declares
  `extensions` and `ContentExtensions` in an interchange-only module once a
  pie-players package consumes them. Until then the players' pass-through of
  untyped fields covers hosts.
- pie-qti owns the QTI mapping and is the bag's first home: its PIE types and its
  LOM source constant.

## Contract Shape

Tiers:

| Tier | Surfaces | Promise |
|---|---|---|
| runtime | Fields players and elements read to load, render or score: `config.elements`, `AssessmentItemRef.settings` | Behaviour, tested, semver-bound |
| interchange | Typed fields with a meaning and a QTI mapping that players carry and never read: `extensions` | Name, shape, meaning, QTI mapping, lossless pie-qti round trip |
| backend | A backend's storage, indexes, search highlights and legacy keys | Nothing. Never named in open-source types or docs |

Copying a value through unchanged does not make it runtime.

The bag:

```ts
type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

type ContentExtensions = Record<string, JsonValue>;

// on ItemEntity, PassageEntity, AssessmentEntity, AssessmentSection,
// AssessmentItemRef
extensions?: ContentExtensions;
```

Keys are opaque and case-sensitive. The name follows Caliper `Entity.extensions`,
xAPI `extensions` and OneRoster `metadata.extensions`: attributes the model carries
and does not interpret.

Promised:

- the field name and its shape on the five entities, semver-bound;
- players, elements and the toolkit pass the value through unchanged, never reading,
  mutating or stripping it;
- a lossless round trip through pie-qti export and import: keys, value types and
  array order;
- PIE defines no keys.

Not promised:

- any player, element, toolkit or scoring effect;
- indexing, search, facets or query syntax;
- a key registry, vocabulary, validation, casing or namespace syntax;
- inheritance or merging between item, item reference, section and assessment;
- confidentiality: whatever reaches the browser is visible to the learner;
- versioning semantics: whether a change makes a new content version is the
  backend's rule.

Placement rule. A key leaves `extensions` for a typed field when a pie-players or
pie-elements-ng component must act on it (runtime), or when pie-qti or a second
backend must interpret it the same way (interchange). Discovery facets, provenance
and product-specific keys stay.

Removed from players-shared, with no alias:

- `SearchMetaData`, `SearchMetaDataEntity` and `searchMetaData` (82596926b);
- `highlights` on `ItemEntity` and `PassageEntity`: search results are a backend
  response type;
- `SettingsMetaData`, `SettingsMetaDataEntity` and `AssessmentSection.settings`: no
  package reads them, and the section demos drop their
  `settings.personalNeedsProfile` fallback, which no demo section used.

## Compatibility

The removals are type-only. Content carrying any removed field still passes through
at runtime, and the consumer pad records that pass-through as load-bearing: Host A's
calculator resolver reads its own item fields off `context.item`. No host
checkout imports `highlights` or `SettingsMetaData` from `@pie-players`. Each
removal ships as a `patch` changeset with its api-report update.

Adding `extensions` is additive.

## Data Ownership And Host Responsibilities

The host or backend owns every key, its meaning and its storage. A writer that knows
the PIE model writes typed fields and projects them into its own storage keys where
its search or legacy readers need them; the projection runs one way. A backend that
keeps legacy keys may derive typed fields from them on read, provided its output
stays additive and a derived field that changes what a current client renders is
opt-in per request. Secrets and answer keys do not belong in the bag.

## Serialization And Versioning

QTI 3 has no metadata slot on `qti-assessment-item`, `qti-assessment-stimulus` or
`qti-assessment-test`, and the content package resource `<metadata>` admits only
`qtiMetadata`, CSM and LOM. The bag therefore travels as LOM on the item's or test's
manifest `<resource>`:

```xml
<lom xmlns="http://ltsc.ieee.org/xsd/LOM">
  <classification>
    <taxonPath>
      <source><string>pie:extension:grade</string></source>
      <taxon><entry><string>4</string></entry></taxon>
    </taxonPath>
  </classification>
</lom>
```

- One `taxon` per array element. A value other than a string or string array also
  carries its JSON in the classification's `description`, as pie-qti does today.
- Export writes no LOM `purpose`; purposeful classification belongs to typed fields,
  which map to CSM and LOM `general` instead.
- Import reads `pie:extension:` and the legacy `pie:searchMetaData:` prefix
  permanently, since exported packages carry the old one. Other `taxonPath` entries
  stay LOM and are not folded into the bag.

This matches how TAO exports custom properties (source = property URI, entry =
value).

## Accessibility

None. The bag has no rendering effect.

## Standards Or Adapter Impact

- pie-qti renames its `searchMetaData` fields to `extensions`, renames
  `PIE_LOM_SEARCH_METADATA_SOURCE` to an extension source valued `pie:extension:`,
  and drops pie-to-qti2's `PURPOSES` map, which exports every key as `idea`.
- Calculator grants stay on `AssessmentItemRef.settings` (`requiredTools`,
  `restrictedTools`, `toolParameters`); Host R derives them there. If a QTI round
  trip of calculators is needed, pie-qti maps `qti-companion-materials-info` onto
  item-reference settings on import and back on export. That mapping is lossy only
  when two references to one item grant different calculators.

## Test Plan

- pie-qti: export then import preserves every key, value type and array order,
  including object, number and null values; an import of a package written with
  `pie:searchMetaData:` yields the same `extensions`; export writes no `purpose`.
- players-shared: the api-report diff shows only the removals, and, when it lands,
  the additive `extensions` declaration.
- A section player test that an `extensions` value on an item reference reaches
  `ToolContext.item` unchanged lands with the declaration.

## Rollout And Release Notes

1. pie-players removals, one `patch` changeset each (both landed).
2. pie-qti rename and prefix change, released independently.
3. `extensions` in players-shared when a pie-players package consumes it, with a
   section in the content-model documentation that lists every metadata surface and
   its tier.

## Open Questions

- Which pie-players package is the first `extensions` consumer. Built-in backend
  delivery is the likeliest; it has no host user yet.
