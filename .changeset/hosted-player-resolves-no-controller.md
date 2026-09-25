---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

A hosted item player no longer runs element controllers in the browser
(PIE-1070). It rendered and scored through any controller in the shared
registry, so with the `esm` strategy, which loaded controllers whether or not
the player was hosted, `model()`, `createCorrectResponseSession()` and
`provideScore()` ran client-side. A hosted player now renders the server's
models and scores nothing locally, as it already did with `iife`, and hosted
`esm` loads no controllers. A host that runs `hosted` with `esm` and relied on
browser-side models has to supply server-processed ones.
