---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
---

Items and passages can be language variants. `ItemEntity` and `PassageEntity` add `language` (BCP 47) and `isAdaptationOf`, `AssessmentEntity` adds `languagePolicy`, and `./types` exports `AdaptationLink`, `LanguagePolicy`, `ContentSubstitution` and `ServedContentIdentity`. The section player sets `env.locale` to an item's or passage's `language` for that content alone and records it as the item session's `content`, which `TestAttemptItemSession` keeps. Item player delivery sends `backend.delivery.requestedLanguages` and, when a load response names the served version as `identity`, renders and scores under its `servedLanguage` and adds `identity` to `backend-load-complete`. `./i18n/language-tags` adds `negotiateContentLanguage`, `findClosestLanguageMatch` and `languageTagScriptLookupSequence`. Content and delivery configs without these fields behave as before.
