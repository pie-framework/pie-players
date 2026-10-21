---
"@pie-players/pie-players-shared": patch
---

`setLocale` lets the last call win: a catalog load that finishes after a later `setLocale` call no longer overwrites that call's locale.
