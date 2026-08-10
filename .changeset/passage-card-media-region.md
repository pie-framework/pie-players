---
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-sign-language": patch
---

Render docked alternates on the passage card, not only the item card.

A catalog card docks to a content node, and a passage owns content nodes exactly
as an item does — so a signed reading of a shared passage is authored once, on the
passage, under the owner scope `<pie-passage-shell>` already registers. Resolution
worked; nothing rendered it, because the media region existed only on the item
card.

The region moves to `SectionCardMediaSplit`, shared by both cards, so there is one
implementation of grant-plus-content availability, mount reconciliation and split
sizing rather than a copy per card kind. The host surface is renamed
`item-media` → `content-media`, since item cards and passage cards open the same
slot and a capability should declare it once: `@pie-players/pie-tool-sign-language`
now exports `CONTENT_MEDIA_SURFACE` in place of `ITEM_MEDIA_SURFACE` and declares
`supportedLevels: ["item", "passage"]`. A host capability that declared
`surfaces: ["item-media"]` must declare `"content-media"` to keep mounting.
