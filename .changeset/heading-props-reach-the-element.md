---
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
---

`baseHeadingLevel` and `includeSrHeading` reflect to attributes on `<pie-item-player>`, so a host controls the item's heading outline for the whole session rather than only its first paint.

A PIE element resolves both itself: it walks up to the nearest `pie-player` / `pie-item-player`, reads the property, falls back to the `base-heading-level` / `include-sr-heading` attribute, and re-renders on a MutationObserver watching those two attributes. The player therefore has to put the value where the element looks. `baseHeadingLevel` was registered without `reflect`, and `includeSrHeading` was not a declared prop at all — it reached the element as an expando. Both were honoured at first paint and inert after it, which made the accommodation unusable anywhere the host adjusts it in response to the learner's profile or a change of surrounding page structure.

`includeSrHeading` is now declared, typed on `PieItemPlayerElement`, and reflected. Because its default is `true`, hosts turn it off through the property: reflection then clears the attribute, and a present boolean attribute means on whatever its value.

No host code changes. A host already passing either prop starts getting live updates; one passing neither is unaffected.

The documented level arithmetic was off by one and is corrected. `baseHeadingLevel` names the level the item's heading occupies, not the level the element emits: the element puts its visually-hidden item heading there when `includeSrHeading` is on, and expects the host's own natural heading there when it is off. Authored `data-heading` content nests one level below either way, so `baseHeadingLevel: 2` yields `h2` for the item heading and `h3`/`h4` for `heading1`/`heading2`. The old text described `@pie-element/*` before it read the host at all, when the rewrite ran off a hardcoded default.
