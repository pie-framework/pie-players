---
"@pie-players/pie-players-shared": patch
---

Load only unresolved custom-element tags while keeping concurrent requests deduplicated by their original and unresolved maps. This allows an IIFE request for a newer package version when the older version is already registered, while retaining rejection of multiple unresolved versions in one legacy bundle. A request that loads controllers also loads its registered tags that lack one, and an IIFE request keeps the bundle URL naming every requested package unless two versions of one package conflict.
