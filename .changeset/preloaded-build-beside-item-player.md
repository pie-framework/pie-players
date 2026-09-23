---
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-cli": patch
---

Load a generated `@pie-players/pie-preloaded-player` build into a page that
already registered `pie-item-player`, which is what a host running the section
player presents (PIE-1070).

The build's own copy of the item player redefined the tag, threw
`NotSupportedError` and rejected the build's initialization. The item player
now registers only through `definePieItemPlayer`, which leaves a registered tag
alone, and the generated entry skips fetching its copy when the tag is taken.
Whichever copy registered `pie-item-player` first renders the build's elements.
`definePieItemPlayer(tagName)` also registers a working element under a custom
tag.
