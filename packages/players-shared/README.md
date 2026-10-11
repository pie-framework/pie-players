# PIE Players Shared

Shared runtime utilities for the `@pie-players/*` player suite: the element
loader, PIE config and session helpers, markup security, i18n, and the
formative, timed-media and media contracts. For framework code and host
integrations that need the helpers the player packages use.

## Public Exports

```ts
import { safeLocalStorageGet } from "@pie-players/pie-players-shared";
import { makeUniqueTags } from "@pie-players/pie-players-shared/pie";
import { normalizeItemPlayerStrategy } from "@pie-players/pie-players-shared";
```

The subpaths below are the package's `exports`; nothing else is importable.

| Subpath | Contents |
| --- | --- |
| `@pie-players/pie-players-shared` | The root: the loader, PIE, security and object helpers, loader config, instrumentation providers, the item-player strategy helpers, the default bundle host URL (`BUILDER_BUNDLE_URL`), a subset of the shared types, and the UI helpers (attribute coercion, content styles, pointer gestures, overlay placement, focus trap, safe storage, scoped CSS) |
| `/loader-config` | `LoaderConfig` and its defaults: instrumentation (`trackPageActions`, `instrumentationProvider`), resource retry, and IIFE bundle retry |
| `/security` | The item-markup sanitizer (`sanitizeItemMarkup`, `createDefaultItemMarkupSanitizer`, `buildAuthoringAllowList`), external-stylesheet URL validation, the SVG icon and `style` attribute sanitizers, and the wrappers that put overwide images and tables in a scrollable region |
| `/object` | `mergeObjectsIgnoringNullUndefined`, `cloneDeep`, `isPlainRecord` |
| `/types` | The shared types: item, passage, section and session entities, PIE models and controllers, accessibility catalogs, and the [media vocabulary](#media-validation) |
| `/formative` | [Formative delivery](#formative-delivery) |
| `/timed-media` | [Timed media](#timed-media) |
| `/media` | [Media validation](#media-validation) |
| `/pie` | PIE runtime utilities: config helpers, bundle initialization, `ItemController` and the item session contract, session commit and snapshots, authoring helpers, math renderer setup, instrumentation event maps ([PIE utilities](src/pie/README.md)) |
| `/pie/tag-names` | Custom element tag helpers: `validateCustomElementTag`, `toViewTag`, `toPrintHashedTag`, `parseVersionedTagName` |
| `/loaders` | The `ElementLoader` primitive and its IIFE and ESM adapters, `registerPreloadedElements`, the element package policy, and the MathJax event names ([Element loading](#element-loading)) |
| `/i18n` | `createPieI18n`, a provider for every bundled locale ([i18n](src/i18n/README.md)) |
| `/i18n/types` | The i18n contract, types only |
| `/i18n/provider` | `SimpleI18n`, `getDefaultI18n` and `resolveInterfaceI18n`, with the English catalog only |
| `/i18n/catalogs` | `BUNDLED_LOCALES` and lazy loaders for the bundled locales other than English |
| `/i18n/language-tags` | BCP 47 language tag normalization and matching |
| `/nds-icon-button` | `<nds-icon-button>`, an icon button vendored as a prebuilt bundle with Lit inlined; importing it registers the tag. The assessment toolkit and `@pie-players/pie-tool-tts-inline` render it |
| `/ui/attribute-coercion` | Boolean attribute coercion for custom elements |
| `/ui/content-styles` | `installContentStyles`, `auditContentStyles` and the opt-out checks behind the item player's content styles |
| `/tools/term-lookup` | Term normalization and the lookup session the dictionary tools share; the host supplies the endpoint or a resolver |

## Formative Delivery

`@pie-players/pie-players-shared/formative` holds the policy resolution, outcome
aggregation, Try-state reducer, item view, and mastery rollup that
`pie-section-player` drives. It is pure (no DOM, no timers, no element
registry), so it is testable without a browser and importable by an adapter that
has no player.

```ts
import {
  aggregateFormativeOutcome,
  resolveFormativePolicy,
  resolveFormativeItemView,
  rollupFormativeMastery,
} from "@pie-players/pie-players-shared/formative";
```

The authored half, `FormativeDeliveryPolicy` on `AssessmentSection` and
`FormativeItemPolicy` on `AssessmentItemRef`, is re-exported from the package
root and from `/types`, beside the section types it annotates.

The contract is [`docs/prds/formative-delivery-contract.md`](../../docs/prds/formative-delivery-contract.md),
including the QTI 3 mapping and why PIE says **Try** rather than "attempt".

## Timed Media

`@pie-players/pie-players-shared/timed-media` holds the timed-media section
vocabulary, its validation, the cue reduction, the session slice, and the **Media
Time Source** port that a section reaches media through. It is pure apart from
`createMediaElementTimeSource`, which is inert until called, so the contract
imports in Node.js beside the rest.

```ts
import {
  createMediaElementTimeSource,
  normalizeTimedMediaSectionData,
  reduceTimedMediaState,
  resolveTimedMediaProjection,
  type MediaTimeSource,
} from "@pie-players/pie-players-shared/timed-media";
```

The port is shaped after `HTMLMediaElement`, so a native `<video>` satisfies it
through `createMediaElementTimeSource`, with two departures: seeking is
`seekTo(seconds)` in place of a writable `currentTime`, and `capabilities`
declares `canPause` and `canRestrictSeeking`, because a source that cannot
control playback needs a way to say so. A host implementing the port directly
needs no PIE element to deliver timed media.

The authored half, `sectionType` and `timedMedia` on `AssessmentSection`, is
re-exported from the package root and from `/types`, beside the section types it
annotates.

The contract is [`docs/prds/timed-media-section-contract.md`](../../docs/prds/timed-media-section-contract.md),
including why cue gate conditions name the formative vocabulary and why an
unenforceable policy degrades to advisory rather than failing closed.

## Media Validation

`@pie-players/pie-players-shared/media` validates authored, wire-facing media
references before they reach a media element:

- `isSafeMediaSrc` is the source-scheme allow-list: relative and
  protocol-relative URLs, `http:`, `https:`, `data:` and `blob:`.
- `normalizeMediaSources` drops unsafe and malformed sources and deduplicates by
  `src`, keeping the first.
- `normalizeMediaFragment` normalizes a fragment range; an end at or before the
  start becomes an open end.
- `isUnsupportedMediaAssetVersion` rejects a `MediaAssetRef.version` other than
  `SUPPORTED_MEDIA_ASSET_VERSION` (1); an absent version passes.
- `applyMediaFragment` writes a fragment range as a Media Fragments URI (`#t=`),
  and `enforceMediaFragment` holds a media element to that range, because
  browsers honor the URI inconsistently.

Nothing runs at import time, so an element imports it without the assessment
toolkit.

```ts
import {
  isSafeMediaSrc,
  isUnsupportedMediaAssetVersion,
  normalizeMediaSources,
} from "@pie-players/pie-players-shared/media";
```

The media vocabulary it validates ships in `/types`:

| Type | Shape |
| --- | --- |
| `MediaAssetRef` | `{ version: 1, id, kind, sources, poster?, thumbnail?, durationSeconds?, tracks?, transcript?, label?, description?, lang? }` |
| `MediaKind` | `"image" \| "audio" \| "video" \| "other"` |
| `MediaSource` | `{ src, type?, width?, height?, bitrate? }` |
| `TextTrackRef` | `{ src, kind, lang, label, default? }`, where `kind` is `captions`, `subtitles`, `descriptions`, `chapters` or `metadata` |
| `TranscriptRef` | `{ src?, html?, plainText?, lang? }` |
| `MediaFragmentRange` | `{ startSeconds, endSeconds? }`: a slice of a longer recording, so one file serves several content nodes |
| `SignLanguageCardPayload` | `{ signLang?, media, fragment? }`, the payload of a `sign-language` catalog card |
| `SpokenAudioCardPayload` | `{ media, fragment? }`, the payload of a recorded `spoken` catalog card |
| `CatalogCardPayload` | Either payload; the card's `catalog` decides which |

The design record is [`docs/prds/shared-contracts/media-asset-contract.md`](../../docs/prds/shared-contracts/media-asset-contract.md).

## Element Loading

`@pie-players/pie-players-shared/loaders` holds the `ElementLoader` primitive and
the IIFE and ESM adapters `<pie-item-player>` loads elements through.
[Loading strategies](../../docs/item-player/loading-strategies.md) documents
their behavior, including the ESM adapter's file layout and CDN providers
([`strategy="esm"`](../../docs/item-player/loading-strategies.md#strategyesm))
and the one-version rule for page singletons such as React
([Shared dependencies](../../docs/item-player/loading-strategies.md#shared-dependencies)).
The producer side is the
[PIE element contract](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/PIE_ELEMENT_CONTRACT.md)
in pie-elements-ng.

## Related Documentation

- [PIE utilities README](src/pie/README.md)
- [i18n README](src/i18n/README.md)
- [Loading strategies](../../docs/item-player/loading-strategies.md)
- [Internationalization](../../docs/architecture/internationalization.md)
