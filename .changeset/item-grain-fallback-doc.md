---
"@pie-players/pie-players-shared": patch
---

`LanguagePolicy` gains `matching`, which with `"exact"` stops a request such as `es-MX` being served `es`. `negotiateContentLanguage` takes it as an option, and its fallback now runs from the closest match for the default language through content that declares no language (a `null` entry) to an optional `source`. `fallback` documents item-grain fallback along that chain.
