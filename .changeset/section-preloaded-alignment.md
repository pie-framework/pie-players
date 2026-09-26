---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
---

The section player's `preloaded` pre-warm aligns authored element versions to
the page's registrations before asserting them, as the item player does, and
reports a failure as an `element-preload` framework error. The `interactive`
stage and `pie-loading-complete` now wait for the pre-warm, a partial `policies`
object takes defaults for its unset fields, and the ESM pre-warm honours
`loaderOptions.loadControllers`. Both players share
`alignPreloadedElementVersions` and `resolveLoadControllers`, exported from
`@pie-players/pie-players-shared`.
