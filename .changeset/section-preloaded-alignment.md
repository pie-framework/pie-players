---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
---

The section player's pre-warm now loads and asserts the view its item players
render. The `preloaded` pre-warm aligns authored element versions to the page's
registrations before asserting them, as the item player does, and a preloaded
author section asserts the `-config` tags; the ESM pre-warm honours
`loaderOptions.view`, `loaderOptions.loadControllers` and author `mode`; and a
hosted IIFE player's pre-warm skips controllers. A failed `preloaded` pre-warm
reports an `element-preload` framework error, and a rejected pre-warm shows an
error in place of the loading message. The `interactive` stage and
`pie-loading-complete` wait for the pre-warm, and a partial `policies` object
takes defaults for its unset fields. Both players share
`alignPreloadedElementVersions` and `resolveLoadControllers`, exported from
`@pie-players/pie-players-shared`.
