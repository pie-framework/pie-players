---
"@pie-players/pie-assessment-toolkit": patch
---

Report unknown catalog types instead of storing them silently.

`CatalogType` ends in `| string`, so its named literals were documentation only:
a card authored `"spokn"` was a perfectly valid `CatalogType` that no reader would
ever ask for, and a lookup for `"brallie"` returned `null` exactly as it would for
a node with no alternate. Both failed by being invisible, which for an
accommodation means the only person who notices is the candidate who needed it.

The type stays open — QTI's support vocabulary is extensible, and catalogs arrive
as authored JSON rather than through this type, so closing it would reject
content PIE cannot usefully validate anyway. What changes is the silence.
`isKnownCatalogType` accepts the types PIE names plus QTI's `ext:`-prefixed
vendor extensions, which pass without comment. Anything else is still registered
and still resolvable, but logged once per distinct token: on the card side naming
the catalog and saying the alternate will never be shown, and on the lookup side
saying it cannot match any card.

The card-side check sits in the one funnel every registration path already runs
through, so the constructor, `addItemCatalogs` and `registerCatalogs` are all
covered without per-entry-point checks.

`transcript` joins the named types. The Learnosity importer emits it, so treating
it as unknown would have warned on ordinary imported audio items — which is the
failure mode this kind of check invites, and the reason the known set was taken
from what producers actually emit rather than from the existing union.
