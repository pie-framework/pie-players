---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-print-player": patch
---

The ESM element loader, the runtime-support probe and the print player's default resolver now refuse an element package spec unless it is a scoped npm name with an optional semver version or dist-tag, so an authored spec such as `@pie-element/x@1.0.0/../../../gh/owner/repo@main` can no longer load a module from another CDN path. The refused element fails on its own as `backend-rejected`, and print renders its missing-element placeholder, which now sets the failure message as text. `isScopedPackageSpec` is exported from `@pie-players/pie-players-shared/loaders`.
