# Accessibility Catalogs - TTS Integration

<!-- markdownlint-disable MD032 MD040 MD060 -->

`TTSService` speaks pre-authored `spoken` catalog cards (SSML) ahead of
generated speech. This page covers how TTS resolves a card and how to diagnose
one that is not spoken. The
[Accessibility Catalogs Integration Guide](./accessibility-catalogs-integration-guide.md)
owns the rest:

- [Section Player Integration](./accessibility-catalogs-integration-guide.md#section-player-integration)
  wires `ToolkitCoordinator` into the player, and
  [Minimal Server-Backed TTS Config](../../packages/assessment-toolkit/README.md#minimal-server-backed-tts-config)
  replaces the browser backend with a server provider.
- [SSML Extraction from PIE Content](./accessibility-catalogs-integration-guide.md#ssml-extraction-from-pie-content)
  turns embedded `<speak>` into `config.extractedCatalogs`, which the runtime
  registers when item and passage shells mount. The runtime does not run the
  extraction itself.
- [Catalog References in Content](./accessibility-catalogs-integration-guide.md#catalog-references-in-content)
  shows where `data-catalog-idref` markers go.

---

## Catalog Resolution Flow

`TTSService` reads a target in this order; the TTS deep dive states each rule in
[How TTS Chooses What To Speak](./tts-deep-dive.md#how-tts-chooses-what-to-speak).

![What TTSService reads for a target, in order: nothing when the target or an ancestor carries data-tts-suppress, a named spoken card's script, each docked region's card with the text between, generated speech for math, and otherwise the visible text; for a selection each rule applies only to what the selection holds whole, and hidden or suppressed parts are skipped with their cards](../img/catalog-tts-resolution.excalidraw.svg)

A named `catalogId` reads only a `spoken` card's script. When the catalog holds
only a recording, or no `spoken` card, resolution moves to the docked regions and
then to generated speech rather than speaking an empty string.

Each card lookup runs in the content owner's context: the catalog registered for
that passage, item or model first, then the one compatible owner, then the
assessment-level catalogs the coordinator was constructed with. When several
compatible owners hold the identifier, the lookup is ambiguous and finds nothing
([Catalog Scope](./accessibility-catalogs-integration-guide.md#catalog-scope)).

### One Attribute, Typed Cards

`data-catalog-idref` names a whole catalog, whose cards can carry several types.
TTS is the attribute's only reader and selects `spoken` cards; the sign-language
capability finds `sign-language` cards among the item's catalogs without
consulting it. `SSMLExtractor` never overwrites an existing `data-catalog-idref`,
because the reference names a whole card array, and replacing it to win one type
would take that node's other cards down with it. When an inline `<speak>` lands
inside a node that is already docked, `SSMLExtractor` keeps the existing
reference, still emits the extracted catalog, and warns. The extracted SSML is
then unreachable by DOM walk; give the `<speak>` its own wrapper, or author it as
a `spoken` card on the existing catalog.

---

## Provider SSML Support

The browser provider speaks a card's text and drops its markup. A server-backed
provider such as AWS Polly applies the tags it supports; the
[TTS Authoring Guide](./tts-authoring-guide.md#ssml-provider-support) lists each
provider's support.

---

## Troubleshooting

### SSML Not Working

**Symptoms:** TTS reads the right words but ignores the authored pronunciation,
pauses or prosody.

**Possible Causes:**
1. **The browser provider is speaking**
   - Check: the configured backend; a server provider that fails to start logs
     `[ToolkitCoordinator] Failed to initialize TTS via registry, falling back to browser provider`
     and reports `pie-tool-init-fallback`
   - Fix: configure a server provider with SSML support and fix the cause of its
     startup failure
2. **The content carries no `data-catalog-idref`**
   - Authored catalogs: put the reference on the element whose content the card
     replaces
   - Extracted catalogs: run `SSMLExtractor` before render, and store its
     catalogs on `item.config.extractedCatalogs`
3. **The lookup does not reach the catalog**
   - Check: the identifier matches the reference exactly, and the catalog sits on
     the content's own entity, model or `config.extractedCatalogs`, or at
     assessment level
   - Check: the console for `Ambiguous scoped catalog`
     ([Catalog IDs Colliding](#catalog-ids-colliding))
4. **Invalid SSML markup**
   - Check: the server provider's error for the failed read
   - Fix: balance the tags and keep to the provider's supported subset
5. **Card language**
   - The lookup prefers a card in the read's language, then the resolver's
     default language, then any card, so a card tagged with another language
     loses to one that matches
   - Fix: tag cards with BCP 47 codes (`en-US`, `es-ES`) that match the content

### Visual Content Shows SSML Tags

**Symptoms:** Users see `<speak>` or `<prosody>` tags in display

**Cause:** the rendered config still carries its `<speak>` markup.

**Fix:**
1. Run `SSMLExtractor` before rendering the content
2. Pass `result.cleanedConfig` to the player, with the catalogs on
   `extractedCatalogs`

### Catalog IDs Colliding

**Symptoms:** another content's card is spoken, or a docked region reads its
visible text although its card exists.

**Causes and fixes:**
1. **An assessment-level catalog shares the identifier.** A lookup the content's
   owner cannot answer falls through to the assessment level and speaks that
   card. Prefix assessment-level identifiers (`shared-passage-photosynthesis`).
2. **Several compatible owners hold the identifier.** The resolver warns
   `Ambiguous scoped catalog` and returns nothing, so the read continues without
   the card. Keep each catalog on the passage, item or model it describes, where
   the exact-owner lookup finds it first; a model's catalogs are filed under the
   model, so two models can reuse one identifier.
3. **Extracted identifiers repeat.** `SSMLExtractor` ids take the form
   `auto-prompt-{modelId}-{n}`, `auto-choice-{modelId}-{value}-{n}` and
   `auto-markup-{n}`, with a counter that belongs to the extractor instance and
   runs until `reset()`. Separate instances, or a `reset()` between items, repeat
   ids for models that share an `id`. Use one instance across an import batch,
   and keep each item's catalogs on its own `config.extractedCatalogs`.

## References

- [Accessibility Catalogs Integration Guide](accessibility-catalogs-integration-guide.md) - Catalog model and integration
- [Accessibility Catalogs Quick Start](accessibility-catalogs-quick-start.md) - Developer quick reference
- [TTS Deep Dive](tts-deep-dive.md) - Runtime flow from the toolbar button to the highlighted word
- [Section player integration guide](../section-player/integration-guide.md) - Runtime integration for section delivery
- [QTI 3.0 Best Practices and Implementation Guide](https://www.imsglobal.org/spec/qti/v3p0/impl) - 1EdTech
