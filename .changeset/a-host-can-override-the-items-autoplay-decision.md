---
"@pie-players/pie-item-player": patch
---

Let a host override the content's autoplay decision through an
`autoplay-audio-enabled` attribute on `<pie-item-player>`.

`autoplayAudioEnabled` is a model field the Learnosity → PIE transform derives per
item from its `rli-kas:STARcollection` tag, and the imported value was the only
answer available at delivery time. The prop is tri-state. Left `undefined` — the
default, and what every host gets without opting in — `applyAutoplayAudioOverride`
returns the same object identity and the config reaches the elements untouched. Set
to `true` or `false`, the value is written onto every entry in `models`, including
entries that never declared the field, so one host answer covers the whole item and
the player stops distinguishing "the content said false" from "the host said false".

It runs inside `prepareConfigEntity`, after `normalizePreloadedElementVersions` and
before `makeUniqueTags`, so a stimulus item's passage config is covered on the same
terms as its item config. Changing the prop re-enters `loadConfig` rather than
mutating a mounted element; the session controller is keyed by item id and is not
reset on that path, so a toggle mid-item does not discard responses.

The override is host surface, not a PNP policy id — it claims no AfA support token
and reads nothing about the learner, so it does not foreclose the per-program answer
`docs/prds/audio-accommodations.md` argues for. That PRD leaves open whether
runtime-adjustable autoplay is required at all: its position is that autoplay goes
both ways *by program*, which makes `MapLearnosityToPieOptions.autoplay.byCollection`
in `pie-api-aws` the natural home and costs PIE nothing. The two paths coexist —
with the prop unset the transform's answer stands unchanged — so whether the
requirement is genuinely runtime-adjustable is still a product decision this does
not settle.

Covered by `packages/item-player/tests/autoplay-audio-override.test.ts`.
