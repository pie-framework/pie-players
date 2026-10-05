---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

An item holding an element whose package has no controller, such as a legacy
`@pie-element/protractor`, loads under `client-player.js`, where it failed with a
player error. The element renders the model it is given, as `<pie-player>` passed
it through.
