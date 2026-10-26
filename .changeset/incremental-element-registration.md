---
"@pie-players/pie-players-shared": patch
---

Load only unresolved custom-element tags while keeping concurrent requests deduplicated by their original and unresolved maps. This allows an IIFE request for a newer package version when the older version is already registered, while retaining rejection of multiple unresolved versions in one legacy bundle.
