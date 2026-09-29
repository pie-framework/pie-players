---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-section-player": patch
---

The vendored module shim no longer breaks webpack builds that run source-map-loader over node_modules, such as Angular development builds.
