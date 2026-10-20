---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-tool-dictionary": patch
"@pie-players/pie-tool-picture-dictionary": patch
"@pie-players/pie-tool-calculator-shared": patch
---

The dictionary, picture dictionary and calculator tools render their learner-visible strings through the interface catalog, so a localized player localizes them too: labels ("Word or phrase", "Look up"), the unconfigured and idle notices, the whole-phrase lookup status ("Looking up “{term}”…", "No entry for “{term}”.") and the calculator's initialization failure. The lookup status summary is a plural group selected by `Intl.PluralRules` rather than a `count === 1` branch, and both dictionary panels now stamp `lang` and `dir` on their host. English rendering is unchanged.
