---
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-shared": patch
---

The item player typesets the math in an item's and a passage's own markup,
outside every element, which `<pie-player>` typeset and `<pie-item-player>` left
as raw TeX. It hands the page's math renderer only the markup around the
elements, so no element's content is typeset twice: under `iife` the renderer
the player installs, under `esm` and `preloaded` one the host installs. On a page
without one, that math stays as authored.
