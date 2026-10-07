---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-player": patch
---

The section player layouts and `pie-assessment-player-default` take a `session` property. The section controller applies it in place of hydrating from the persistence strategy, before it is published, and a later assignment follows `pie-item-player`'s rules: an equal value is a no-op and a response-free item session keeps recorded responses. `sectionFromItem`, from the new `@pie-players/pie-section-player/item-section` subpath, turns one item config and its session into the `section` and `session` a layout takes; a referenced item and its passage may now omit `baseId` and `version`.
