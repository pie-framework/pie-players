---
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
---

Content that declares no language no longer takes the interface locale's `lang` and `dir` once a host sets `locale`: the item player stamps it `lang=""` with `dir="auto"`, so Arabic chrome over English content lays the content out left to right. A new `content-language` attribute on `pie-item-player` names the language instead, and a section passes `runtime.contentLanguage` to its item and passage players the same way. A host that sets neither `locale` nor a content language renders as before. The item player logs one warning when undeclared content's script contradicts a named default's direction, and read-aloud's `lang` lookup stops at an empty `lang`.
