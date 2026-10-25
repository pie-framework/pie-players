# Curriculum Standards And Skill Levels

Status: Draft, 2026-10-24

Implementation status: nothing has landed. pie-players owes the two interchange
types in a players-shared interchange-only module, the content-model page with its
provider-id registry, and the narrowing of the scope line in
[framework-completing work](../architecture/framework-completing-work.md). pie-qti
owes the QTI round trip.

Owner: PIE Players maintainers

This PRD adds two optional, QTI-aligned fields to items and passages:
`curriculumStandards`, the standards, skills and competencies content is aligned to,
and `skillLevels`, its cognitive complexity (Webb's DOK, Bloom's). Both are
interchange model: players carry them and never read them. It is for maintainers of
players-shared and pie-qti, and for backends and authoring systems that write the
fields.

Related architecture:

- [Framework-completing work](../architecture/framework-completing-work.md)
- [Content extensions and metadata tiers](./content-extensions.md)
- [Internationalization](../architecture/internationalization.md)

## Problem

PIE content has no typed place for alignment. Backends store standards as untyped
keys in their own metadata, each with its own key names, sentinels and casing, so a
second backend or a QTI export cannot interpret them. The keys lose what authoring
systems record, such as which link is primary and which links a crosswalk generated,
and they mix authoring workflow states into the data as sentinel values. Writers
that publish display codes in place of identifiers make content unfindable, because
codes are not unique across frameworks. The scope doc lists standards and skill alignment as
product-completing, which leaves every backend to invent its own model.

## Goals

- One typed, optional model for curriculum standards and skill levels on items and
  passages, named after QTI 3.
- A key that survives every backend and framework: provider plus issued identifier.
- Primacy and crosswalk provenance carried explicitly.
- A lossless QTI 3 round trip, PIE extensions included.
- Every proposed surface tagged with its contract tier.

## Non-Goals

- Resolving identifiers, framework hierarchy, crosswalks, successors or framework
  DOK. Content stores direct links; a framework provider resolves structure on read.
- A standards catalog or framework distribution.
- Roll-ups, mastery by standard or reporting. `FormativeMasteryRollup` stays flat.
- Part-grain alignment (per interaction). The extension path is recorded under
  Contract Shape; it ships when a writer aligns parts.
- Assessment-level alignment. A roll-up is computed downstream, and an authored
  blueprint belongs to the host.
- Any backend's storage, index fields, legacy keys or query API.

## Package And Export Ownership

- Owning package: `@pie-players/pie-players-shared`.
- Public export path: `@pie-players/pie-players-shared/types`. The two types live in
  an interchange-only module under `src/types/` that `index.ts` re-exports, so a
  player import of them stands out in review.
- pie-qti owns the QTI 3 mapping, in its PIE types and its LOM and CSM transforms.
- Consumers: backends and authoring systems that write content, pie-qti, and hosts
  that read alignment for search or reporting. No pie-players or pie-elements-ng
  package reads the fields.
- Runtime environment: none. The fields are data, carried in content JSON.

## Contract Shape

```ts
// Documentation sketch only.
// players-shared interchange module: carried by players, read by none.

/**
 * One curriculum standard, skill or competency the content is aligned to.
 * QTI 3 Curriculum Standards Metadata (CSM 1.1), one entry per labelledGUID.
 */
export interface CurriculumStandard {
	/** CSM curriculumStandardsMetadata@providerId: who issued `guid`. */
	providerId: string;
	/** CSM labelledGUID/GUID, as the provider issued it. */
	guid: string;
	/** CSM labelledGUID/caseItemURI, for a CASE framework item. */
	caseItemURI?: string;
	/** CSM labelledGUID/label: a display code. Never a key. */
	label?: string;
	/** LOM classification purpose. Absent means "educational objective". */
	purpose?: "educational objective" | "prerequisite" | (string & {});
	// PIE extensions; QTI 3 has no equivalent.
	/** The record's main standard for this provider. At most one per providerId. */
	primary?: boolean;
	/** How the link was made. */
	provenance?: "authored" | "derived" | "imported";
	/** For a derived link: the link it was generated from. */
	derivedFrom?: { providerId: string; guid: string };
}

/** A cognitive-complexity classification. LOM classification purpose "skill level". */
export interface SkillLevel {
	/** LOM taxonPath source: "webb-dok", "blooms-revised", "blooms-original", or a host taxonomy. */
	source: string;
	/** LOM taxon id: "1".."4" for webb-dok; "remember".."create" for blooms-revised. */
	id: string;
	/** PIE extension: the author's justification. */
	rationale?: string;
}

// On ItemEntity and PassageEntity, beside accessibilityCatalogs:
curriculumStandards?: CurriculumStandard[]; // absent: no data; []: none applies
skillLevels?: SkillLevel[];
```

Tiers:

| Surface | Tier |
|---|---|
| `curriculumStandards`, `CurriculumStandard` and every member | interchange |
| `skillLevels`, `SkillLevel` and every member | interchange |
| Provider-id registry on the content-model page | interchange |
| `resourcePartId` (deferred) | interchange |
| `FormativeMasteryRollup` | runtime, unchanged |
| Storage, indexing, filters, catalogs, legacy-key mapping | backend |
| Resolution, roll-ups, mastery, reporting | host product |

Decisions:

1. **Names.** `curriculumStandards` follows CSM; `skillLevels` follows LOM
   classification purpose "skill level", which CASE `hasSkillLevel` shares. QTI terms
   win over authoring-system terms (alignment, complexity level), as for
   `accessibilityCatalogs`.
2. **Flat shape.** One entry per `labelledGUID`, dropping CSM's
   `curriculumStandardsMetadataSet` → `curriculumStandardsMetadata` → `setOfGUIDs`
   nesting, as `accessibilityCatalogs` drops `qti-catalog-info`. The entity stands for
   the set's `resourceLabel`. `setOfGUIDs` `region` and `version` are omitted: an
   export derives them from the provider's catalog, and nothing in PIE reads them.
3. **Key.** `providerId` + `guid`, CSM's own key. A CASE URI alone would leave
   content without CASE identifiers unaligned, so `caseItemURI` is optional. Display
   codes go in `label` only, because they repeat across frameworks. GUIDs are stored as
   issued and compared case-insensitively, since providers mix cases and CASE UUIDs
   are lowercase.
4. **No version field.** Providers retire an identifier when its meaning changes and
   point to a successor, so the GUID pins the meaning. Retired GUIDs are carried raw.
5. **Purpose, primacy, provenance.** `purpose` is LOM's; schema.org "teaches" is left
   out, with no QTI term and no writer. `primary` and `provenance` are PIE extensions,
   because primacy is lost today when a writer flattens links into a set, and
   crosswalk-generated links cannot be told apart from authored ones.
6. **Direct links only.** Content records the alignment someone made. Ancestor paths
   go stale when a framework re-parents, and generated links copied onto content
   diverge from the framework's many-to-many relations. `derivedFrom` is the one
   derivation content keeps, and it marks the link rather than expanding it.
7. **Skills share `curriculumStandards`.** CSM carries any provider's GUIDs, CASE
   models a skill as a framework item, and primacy and provenance apply to skills
   too. LOM purpose "competency" would split one relation across two fields of
   different shape. A skill framework takes its own provider id, distinct from any
   standards id its publisher holds, so a later standards framework from the same
   organization cannot collide with it.
8. **DOK in two places.** An item's DOK is authored and goes in `skillLevels`. A
   framework node's DOK is a ceiling or a range and stays on the node; an item value
   cannot be derived from it.
9. **Array of skill levels.** Revised Bloom's is multi-cell, combined values such as
   DOK 1–2 exist, and original and revised Bloom's coexist in live content. A
   `depthOfKnowledge` enum would hard-code one taxonomy.
10. **Grain.** Items and passages ship now; a passage's alignment belongs to the
    passage and items do not inherit it. Part grain is deferred to an optional
    `resourcePartId` naming the model id, as in CSM
    `curriculumStandardsMetadataSet@resourcePartId`.

Provider-id registry. The content-model page lists provider ids with their issuer
and identifier form. Ids come from the
[1EdTech GUID Provider Registry](https://www.imsglobal.org/cc/guidregistry1.cfm)
where the issuer is listed there, starting with `"AB"` (Academic Benchmarks).
The registry is open to host values; PIE validates none.

## Compatibility

- [x] Additive optional fields on `ItemEntity` and `PassageEntity`; every current
      record stays valid.
- [x] No player, element or toolkit behaviour change.
- [ ] api-report update for players-shared.
- [ ] Framework-completing work scope line narrowed to alignment-based resolution,
      roll-ups, mastery and reporting.

## Data Ownership And Host Responsibilities

PIE owns:

- the two type shapes, their meaning and their QTI mapping;
- the provider-id registry document;
- the guarantee that players and the toolkit carry the fields verbatim and never read
  them.

Hosts, backends and authoring systems own:

- writing the fields at publish, including `primary`, `provenance` and `derivedFrom`;
- storage, indexing and filtering;
- framework catalogs, resolution, crosswalks and successor handling;
- any mapping from their own legacy keys, which stays on their side and is never named
  in PIE types or docs;
- mastery, roll-ups and reporting.

## Serialization And Versioning

- Version field: none, per decision 4. The fields are optional members of the entity.
- Validation owner: the writer. PIE ships types only.
- Unknown fields: carried through, as for all content.
- Unknown `purpose` and `source` values: carried as issued.
- Migration: none. No existing PIE type is replaced.
- Round-trip fixtures: in pie-qti (see Test Plan).

QTI 3 mapping, on the item's or passage's manifest `<resource>` `<metadata>`:

| PIE | QTI 3 |
|---|---|
| `curriculumStandards` entry | CSM 1.1 `curriculumStandardsMetadata` (grouped by `providerId`) → `setOfGUIDs` → `labelledGUID` |
| `guid`, `caseItemURI`, `label` | `labelledGUID` children `GUID`, `caseItemURI`, `label` |
| `purpose` | LOM `classification/purpose`, with a `taxonPath` naming the GUID |
| `skillLevels` entry | LOM `classification`, purpose "skill level", `taxonPath/source` = `source`, `taxon/id` = `id` |
| `primary`, `provenance`, `derivedFrom`, `rationale` | LOM `classification/taxonPath` under a `pie:` source, keyed by `providerId` + `guid` |

The PIE extensions travel as LOM because the QTI 3 content-package schema admits only
`qtiMetadata`, CSM and LOM in resource metadata, and neither the CP nor the CSM 1.1
schema declares a wildcard element or attribute. A PIE-namespaced element would not
validate. The LOM encoding follows the one
[content extensions](./content-extensions.md#serialization-and-versioning) uses: no
LOM `purpose`, the value in `taxon/entry`, and JSON in the classification's
`description` for non-string values. Other QTI consumers read CSM and LOM and
ignore the `pie:` sources.

Dropping the extensions on export would break the interchange promise, and entry
order cannot stand in for `primary`: CSM gives order no meaning.

## Accessibility

None. The fields have no rendering effect.

## Standards Or Adapter Impact

- QTI 3: CSM 1.1 and LOM classification, as mapped above.
- CASE 1.1: `providerId` ↔ CFDocument, `guid` ↔ CFItem identifier, `caseItemURI` ↔
  CFItem uri, `label` ↔ humanCodingScheme, `derivedFrom` ↔ an `exactMatchOf`
  association, `skillLevels` ↔ `hasSkillLevel`.
- schema.org / LRMI: `AlignmentObject` `educationalFramework`, `targetUrl`,
  `targetName`; `complexityLevel` for skill levels.
- pie-qti already reads CSM GUIDs as import candidates (`common-cartridge-csm` in
  `source-profiles`) and writes PIE LOM classifications (`pie-lom` in
  `transform-types`); the round trip builds on both.

## Test Plan

- pie-qti: export then import preserves every `curriculumStandards` and `skillLevels`
  member, including `primary`, `provenance`, `derivedFrom` and `rationale`, entry
  order, `[]` versus absent, and GUID case.
- pie-qti: an exported package validates against the QTI 3 CP and CSM 1.1 schemas.
- pie-qti: a package carrying CSM and LOM without `pie:` sources imports with the
  extensions absent.
- players-shared: the api-report diff shows only the two additive fields and the two
  exported interfaces.
- Fixtures, tests and examples use synthetic GUIDs. GUIDs and statements from a
  licensed provider catalog are never committed, because the licence covers the
  identifiers themselves.

```sh
bun run typecheck
bun run test
```

## Rollout And Release Notes

1. players-shared types, the content-model page with tiers and the provider-id
   registry, and the scope-line narrowing, in one `patch` changeset under the
   patch-only release policy.
2. pie-qti round trip, released independently.
3. Backends and authoring systems write the fields on their own schedules. A legacy
   key retires once no host filters on it, on the owning backend's side.

Migration notes: none. Release risk: low; additive optional fields with no reader in
pie-players.

## Open Questions

None.
