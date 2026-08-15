---
"@pie-players/pie-print-player": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

Print resolves accessibility catalogs, so an alternate representation reaches paper. `<pie-print>` takes an `accessibility` config carrying the learner's profile.

Print renders from the item model alone, so an alternate carried as a catalog card reached paper only where some element happened to render it from a legacy model field. With the transcript moved onto a card and rendered by the toolkit, print was the last consumer of `model.audioTranscript` — and braille, simplified-language and extended-description all arrive the same way.

```js
player.config = {
  item,
  options: { role: "student" },
  accessibility: {
    personalNeedsProfile: { supports: ["transcript"] },
    // district blocks and test-administration overrides, when a program has them
    settings,
    // this item's required/restricted supports
    itemSettings,
  },
};
```

Three things worth knowing about it:

- **A print job is one learner with one profile, decided once**, so print has no coordinator and nothing to toggle. It asks the same question the section player asks continuously — given this item and this profile, which alternates are in play — through the same policy engine, the same catalog resolver, and the grant-AND-content rule now shared as `resolveContentCapabilities` in `@pie-players/pie-assessment-toolkit/tools/internal`. A second reader for the one-shot case would be two renderers disagreeing about the same card.
- **An alternate the item declares as authored presentation prints with no `accessibility` config at all.** An item family designed to be delivered with its transcript on screen is not an accommodation, and print resolves unconditionally for that reason. An accommodation card with no profile supplied still prints nothing.
- **Print opens the in-flow host slot and not the docked-media one.** That is a property of paper rather than a preference: a signed alternate is a video, and on paper a video is a blank rectangle. Every alternate that can be read in order reaches print by declaring the slot, with no change in print.

The capability's accessible name is rendered as a visible label above its content and pointed at with `aria-labelledby`. Paper has no accessibility tree, and an unlabelled block of prose above an item reads as part of the item.

The default capability set is `CONTENT_ALTERNATE_REGISTRATIONS` from `@pie-players/pie-default-tool-loaders` — the packaged capabilities that carry an authored alternate and render it as a region, pinned against the packaged composition in both directions so an alternate added there cannot quietly fail to reach print. A deployment composing its own set passes `accessibility.registrations`.
