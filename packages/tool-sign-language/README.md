# @pie-players/pie-tool-sign-language

The sign-language accommodation for PIE assessment players: a signed translation
of an item, docked beside its content.

This package is also the worked example of a capability contributed entirely from
outside the player. It is authored against
`@pie-players/pie-assessment-toolkit/tools/internal` — the same entry point the
packaged registrations use — and `@pie-players/pie-section-player` reaches it only
through `ToolRegistry.getToolsBySurface("content-media")`. No package in the player
names signing, the `signLanguage` support id, the `sign-language` catalog type or
this package.

## Opting in

```ts
import { signLanguageRegistration } from "@pie-players/pie-tool-sign-language";

registry.register(signLanguageRegistration);
```

Importing the package registers the `pie-tool-sign-language` element, so there is
nothing else to wire and no module-loader entry to add.

Signing is deliberately absent from `createPackagedToolRegistry` and
`DEFAULT_TOOL_MODULE_LOADERS`. It is an accommodation with an authored-content
dependency: a default that granted it would hand the accommodation to every
learner whose item happened to carry a card.

## Availability

Two independent halves, both required, neither implying the other.

**Eligibility** — policy granted `signLanguage`. Signing is an accommodation, so
silence means no. The host asks `decideFeaturePolicy` and never consults tool
placement: `activation: "region"` means there is no button to press, so a
`tools.placement` entry naming this capability is reported as unplaceable rather
than silently doing nothing.

**Content** — the item or passage carries a matching `sign-language` catalog card. QTI
approximates AfA's DRD in-band: the presence of the card *is* the resource
declaration. This half is `requiresAuthoredContent.resolve`, and it is why a
learner with the accommodation still sees nothing on content that has no signed
alternate. The catalog resolver supplies an immutable owner snapshot after it
has applied entity/extracted/model traversal and registration precedence; this
package owns only card validation and sign-language matching.

A signed alternate reaches content one way only: as a catalog card, authored or
written by an importer. There is no path that lifts a signing video out of item
markup at render time — one was implemented and removed, because it had no
producer and failed in the wrong direction, leaving the video in visible content
for every learner when the markup could not be parsed.

## No cross-sign-language substitution

ASL, BSL and LSF are not interchangeable. Handing an ASL learner a BSL recording
is worse than handing them nothing. `resolveSignLanguageAlternate` scans the
owner snapshot for an exact requested-language match first, then permits an
unlabelled card as the only fallback. A card labelled with another sign language
is never substituted.

## The element

`<pie-tool-sign-language>` — open shadow root, mounted by the registration's
`renderSurface`, never authored directly. Props are `media` (a resolved
alternate) and `ttsService`; signing playback and read-aloud pause each other, and
the action the learner just took wins.

Sizing is driven by the recording's own frame shape, because signing needs height
for hands and face. Host overrides:

| Custom property | Default |
| --- | --- |
| `--pie-section-player-item-media-aspect-ratio` | `3 / 4` |
| `--pie-section-player-item-media-min-height` | `220px` |
| `--pie-section-player-item-media-max-height` | `60vh` |

The region's share of the card width, the drag-to-resize handle and the stacking
breakpoint belong to the host: that is the card's layout, not the capability's.

## Related

- [`docs/prds/sign-language-asl-support.md`](../../docs/prds/sign-language-asl-support.md)
- [`docs/TOOL_REGISTRY.md`](../assessment-toolkit/docs/TOOL_REGISTRY.md) — host
  surfaces and content dependencies
