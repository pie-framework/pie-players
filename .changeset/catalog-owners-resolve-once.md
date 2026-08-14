---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-sign-language": patch
"@pie-players/pie-tool-tts-inline": patch
---

Make accessibility catalog ownership one resolver contract.

Mounted items and passages now register all entity-root, extracted, and model
catalogs through one owner transaction. Content surfaces observe a bound owner
view and give capabilities an immutable, deterministic catalog snapshot instead
of exposing the raw entity, resolver, and separately assembled owner context.
Signing and transcript capabilities now own only their card interpretation.

Capability authors should read `ToolContentDependencyContext.catalogs` and no
longer use the removed catalog-collection exports. Direct resolver clients,
including inline TTS, retain `getAlternative(...)` and
`catalogOwnerContextFor(...)`. Existing catalog IDs, card and payload shapes,
`data-catalog-idref`, scoped lookup precedence, TTS fallback behavior, and
section-player custom-element contracts are unchanged. Invalid optional catalog
data remains recoverable: it is warned about and omitted without blocking the
primary assessment content.
