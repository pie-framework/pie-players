---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-theme": patch
---

The players install no global content stylesheet when the host already loads
its own copy, scoped or not, and remove theirs when a host copy arrives after
them. `<html data-pie-content-styles="host">` still opts out explicitly.
