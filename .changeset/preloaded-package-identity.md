---
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
---

`registerPreloadedElements` reads an entry's `package` and `version` from the `piePackage` its `./browser/*` modules export, and defaults `tag` to the package name without its `@`, with `-` for `/`, so `{ element, controller }` registers a pie-elements-ng release that exports it. A `package` or `version` the entry also gives must match the modules, and an element module and controller module from different builds throw. Every entry's versioned tag is now validated before any is registered.
