---
"@pie-players/pie-i18n-generated": patch
---

Add Welsh (`cy`) and Swedish (`sv`) generated locale catalogs, alongside UK
English (`en-GB`) and Arabic (`ar`) already in this package and US English
(`en-US`), the bundled fallback in `players-shared`. Both new catalogs are
machine-generated and unreviewed at 517/517 keys against the current English
source; Welsh carries all six CLDR plural categories on every plural group.
Hosts opt in by adding `cy`/`sv` to `availableLocales` — nothing loads until a
host requests them.
