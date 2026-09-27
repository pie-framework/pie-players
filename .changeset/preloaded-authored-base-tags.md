---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

With `strategy="preloaded"`, content can author a package under another base tag
than the page registered it under, such as `multiple-choice` for a package
registered as `pie-element-multiple-choice`. Before asserting, the item player
and the section player's pre-warm define each such versioned tag from the
registered element, with its controller and bundle type, through
`defineAuthoredPreloadedTags` in `@pie-players/pie-players-shared/loaders`. A tag
whose package the page did not register still fails `assertRegistered`.
