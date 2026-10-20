---
"@pie-players/pie-players-shared": patch
---

Every `lang` the players write is canonical. A provider honours an unshipped
locale tag as the host spelled it (it may be the key its host messages are
registered under), so `getLocale()` can return `NL-nl` — a valid request, not a
valid attribute value. `canonicalLanguageTag` (`Intl.getCanonicalLocales` over a
usable primary subtag, the rule PIE elements apply to `model.language`) now runs
at the seams that write attributes: `stampInterfaceLocale` and the `getLocale()`
of the facade `resolveInterfaceI18n` returns, which every template stamp reads.
The provider's own `getLocale()` keeps the resolved tag for lookups. The content
stamp's helper, added earlier as `canonicalContentLanguageTag` and never
released, takes the generic name. A host that spelled an unshipped tag `NL-nl`
sees `lang="nl-NL"` stamped; a canonical tag is unchanged.
