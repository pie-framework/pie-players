---
"@pie-players/pie-players-shared": patch
---

`negotiateContentLanguage` records `substitution: "variety"` when its closest match is another variety of the requested language, one naming a different region or different variant subtags (`es-MX` served `es-ES`, `en-GB` served `en-US`); `es-MX` served `es` is not. `ContentSubstitution` gains `"variety"`, so hosts that branch on a served identity's `substitution` should handle it.
