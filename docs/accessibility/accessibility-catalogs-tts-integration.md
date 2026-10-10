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
- [PIE Element Authoring](./accessibility-catalogs-integration-guide.md#pie-element-authoring)
  shows where `data-catalog-idref` markers go.

---

## Catalog Resolution Flow

The TTSService follows this resolution flow:

```
┌──────────────────────────────────────────────┐
│ ttsService.speak(target, { catalogId })      │
└──────────────────────┬───────────────────────┘
                       ▼
     ┌──────────────────────────────────┐  YES
     │ catalogId names a spoken card    ├──────► Speak the card's
     │ with content?                    │        content (SSML)
     └─────────────────┬────────────────┘
                       │ NO
                       ▼
     ┌──────────────────────────────────┐  YES
     │ target holds data-catalog-idref  ├──────► Compose: each such node's
     │ nodes with spoken cards?         │        card, visible text between
     └─────────────────┬────────────────┘
                       │ NO
                       ▼
            Generated speech: MathML
            speech, else visible text
```

A `catalogId` card counts only when it is a `spoken` card that carries a string.
A card with no string form, such as a `sign-language` card on the same
`data-catalog-idref` node, is not TTS content, and resolution moves to the next
step rather than speaking an empty string.

**Priority Order:**
1. Catalogs scoped to the active item/model, including `config.extractedCatalogs`
2. Shared assessment catalogs supplied to `ToolkitCoordinator`
3. Generated speech, including supported MathML speech
4. Visible text fallback

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

Browser TTS is the always-available fallback and reads SSML as plain text. A
server-backed provider such as AWS Polly applies the tags it supports; the
[TTS Authoring Guide](./tts-authoring-guide.md#ssml-provider-support) lists each
provider's tag reference.

For `TTSService` tests, follow the mock provider pattern in
[`tts-service-catalog-composition.test.ts`](../../packages/assessment-toolkit/tests/tts-service-catalog-composition.test.ts).

---

## Troubleshooting

### SSML Not Working

**Symptoms:** TTS uses plain text instead of SSML pronunciation

**Possible Causes:**
1. **SSML was not extracted before render**
   - Check: Does content have `<speak>` tags?
   - Fix: Run `SSMLExtractor` or an equivalent preprocessing step before render

2. **Catalog ID not passed to TTS**
   - Check: Does element have `data-catalog-idref` attribute?
   - Fix: Verify SSMLExtractor ran (check `item.config.extractedCatalogs`)

3. **Invalid SSML markup**
   - Check: Browser console for SSML parsing errors
   - Fix: Validate SSML syntax (matching tags, proper attributes)

4. **Language mismatch**
   - Check: SSML `xml:lang` matches TTS request language
   - Fix: Use consistent language codes (`en-US`, `es-ES`, etc.)

### Visual Content Shows SSML Tags

**Symptoms:** Users see `<speak>` or `<prosody>` tags in display

**Cause:** SSML extraction not running

**Fix:**
1. Run `SSMLExtractor` before rendering the content
2. Verify the cleaned config is passed to the player
3. Verify `item.config.extractedCatalogs` contains the generated catalogs
4. Check browser console for catalog registration errors

### Catalog IDs Colliding

**Symptoms:** Wrong SSML spoken for content

**Cause:** Duplicate auto-generated catalog IDs

**Fix:**
1. SSMLExtractor appends a counter to each id
2. Format: `auto-prompt-{modelId}-{n}`, `auto-choice-{modelId}-{value}-{n}`, `auto-markup-{n}`
3. The counter belongs to the extractor instance and runs until `reset()`, so one instance never repeats an id; separate instances, or a `reset()` between items, repeat ids for models that share an `id`
4. Shell-scoped catalog registrations are replaced on navigation

## References

- [Accessibility Catalogs Integration Guide](accessibility-catalogs-integration-guide.md) - Complete integration patterns
- [Accessibility Catalogs Quick Start](accessibility-catalogs-quick-start.md) - Developer quick reference
- [Section Player Client Guide](../section-player/client-architecture-tutorial.md) - Current runtime integration surface for section delivery
- [QTI 3.0 Specification](https://www.imsglobal.org/spec/qti/v3p0) - IMS Global standard
