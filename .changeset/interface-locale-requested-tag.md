---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-item-list": patch
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-context": patch
"@pie-players/pie-i18n-generated": patch
---

Players answer `interfaceLocaleContext` with the locale the host asked for, from the moment it is set, and `<pie-item-list>` and `<pie-item-summary>` forward `locale` so an explicit `en-US` is answered there too. The toolkit and section shell stamp `lang` and `dir` only once a host chose a locale. In the i18n engine, `getLocale()` names the locale actually served, a host override for `es-MX` layers over a shipped `es` catalog, and a host override of one plural category keeps the catalog's other forms instead of throwing.
