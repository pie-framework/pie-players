---
"@pie-players/pie-i18n-generated": patch
---

Add five machine-generated locales to the optional tier, chosen against the edtech markets the suite ships into: `en-GB` and `en-AU` (British/Australian English delta catalogs), `es` (Latin-American neutral Spanish), `fr` (France French) and `ar` (Modern Standard Arabic — the suite's first RTL locale, whose six CLDR plural categories run the full plural machinery). Each ships with a terminology brief, enters as `generated` (unreviewed, freshness-gated), and registers under a tag chosen for variant reach: bare `es`/`fr`/`ar` catch every regional host through RFC 4647 widening, while `en-GB`/`en-AU` stay regional so bare `en` keeps resolving to bundled English. Arabic's layout audit (RTL mirroring, fonts) is still owed before a Middle East host promotes it.
