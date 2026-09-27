---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

A hosted item player no longer runs element controllers in the browser
(PIE-1070). It rendered and scored through any controller in the shared
registry, so with the `esm` strategy, which loaded controllers whether or not
the player was hosted, `model()`, `createCorrectResponseSession()` and
`provideScore()` ran client-side; a registered controller also ran over the
models a backend refresh or `updateElementModel()` handed a hosted player. A
hosted player now renders the server's models and scores nothing locally, as it
already did with `iife`, and hosted `esm` loads no controllers. A
`<pie-item-player>` with `backend.delivery` enabled defaults `hosted` to true,
as the section player already did. A host that runs `hosted` with `esm` and
relied on browser-side models has to supply server-processed ones.
