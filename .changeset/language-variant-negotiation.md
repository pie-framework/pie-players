---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/tts-client-server": patch
---

`negotiateContentLanguage` and `findClosestLanguageMatch` widen to a sibling only when it carries the request's variant and private-use subtags, so `en-GB` is never served `en-GB-x-gulf`, and `negotiateContentLanguage` ranks siblings source first, then by tag, so the order of `available` never decides. Read-aloud sends the content language without variant subtags, so `en-GB-x-gulf` is read by an `en-GB` voice. New export: `languageTagWithoutVariants`.
