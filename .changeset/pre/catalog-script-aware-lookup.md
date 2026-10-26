---
"@pie-players/pie-assessment-toolkit": patch
---

Catalog card lookup stays within the requested script: a `zh-TW` read takes a `zh-Hant` card and passes over a Simplified bare `zh` card to the default language. Lookups whose script matches resolve as before.
