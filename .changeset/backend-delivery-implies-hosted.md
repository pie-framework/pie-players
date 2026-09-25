---
"@pie-players/pie-item-player": patch
---

A `<pie-item-player>` with `backend.delivery` enabled defaults `hosted` to
true, as the section player already did, so it runs no element controller in
the browser. It also stops running a registered controller over the models a
backend refresh or `updateElementModel()` hands a hosted player.
