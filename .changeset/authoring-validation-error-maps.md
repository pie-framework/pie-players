---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

`validateModels()` handles the field → message map PIE controllers return
(PIE-1083). Each validated model is `{ ...model, errors }`, where the map's
messages used to overwrite model fields such as `prompt`; `hasErrors` is true when
any map is non-empty, with ebsr's `partA` and `partB` checked separately; and each
configure element receives the errors as `model.errors`, so its inline messages
render. `validatedModels` entries no longer carry a `validation` field.
