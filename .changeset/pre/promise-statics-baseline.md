---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
---

The toolkit no longer calls `Promise.allSettled`, so tool modules load on pages where the global `Promise` lacks it, as zone.js 0.9.1's replacement does; such pages failed with `Promise.allSettled is not a function`. `settleAll` is exported from `@pie-players/pie-players-shared/promise`, and the bundle-safety check now fails any built bundle that calls a `Promise` static other than `all`, `race`, `resolve` or `reject`.
