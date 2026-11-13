---
"@pie-players/pie-item-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-context": patch
---

`pie-item-player` and `pie-assessment-toolkit` answer `interfaceLocaleContext` only once a host chooses a locale: `locale` set, or a supplied provider resolving a locale other than `en-US`. Before that a PIE element labels its chrome in the language its item declares, as on pie-elements, instead of in a default `en-US`; a host that wants English over the item's language sets `locale="en-US"`. `hostChoseInterfaceLocale` in `@pie-players/pie-players-shared/i18n` holds the rule.
