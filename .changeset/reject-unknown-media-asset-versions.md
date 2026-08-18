---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-sign-language": patch
---

Reject a media reference whose `version` this build does not implement, instead
of rendering it on a guess.

`MediaAssetRef.version` is a required literal and the shared contract requires
unknown-version rejection for runtime rendering, but both card validators cast
the payload to `Partial<MediaAssetRef>` and never read the field, so a card
claiming version 2 rendered as though it were version 1 — with whatever the
fields meant then. `isUnsupportedMediaAssetVersion` now guards both, and the
toolkit exports it alongside the other media-payload validators a capability
package needs.

An absent `version` is still accepted. Producers predate the field, and this
module's posture toward absent fields is to treat them as absent rather than as
a positive claim of something else — the same rule `media.kind` and
`matchesRequestedSignLanguage` already follow.
