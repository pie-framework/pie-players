---
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player": patch
---

With the ESM strategy, the players on a page share one request for each element
package's `package.json`. A request that fails is dropped, so the next load
retries it.
