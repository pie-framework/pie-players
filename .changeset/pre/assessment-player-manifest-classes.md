---
"@pie-players/pie-assessment-player": patch
---

`<pie-assessment-player-default>`'s light-DOM class hooks
(`pie-assessment-player-default`, `-navigation`, `-nav-btn`, `-status-message`,
`-announcer` and the rest) are now recorded in the package's
`custom-elements.json`. They were always part of the element's styling surface
— in a light-DOM element every class name is public API — but the manifest
generator only read Svelte templates, so the classes a TypeScript element
writes from script (`className =`, `classList.add`/`remove`/`toggle`) were
invisible to tooling and to the surface-drift check. The generator now reads
both, which is what makes a future rename of one of these hooks register as a
reviewed surface change.
