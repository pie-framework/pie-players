---
"@pie-players/pie-item-player": patch
---

A standalone item player with a requested `locale` now stamps the interface locale's `lang` and `dir` on itself. Standalone, the player is the outermost chrome — its configuration-error banner renders interface strings — and no stamped ancestor exists above it, so under `locale="ar"` the banner read without a language and laid out left-to-right. Rendered-attribute visible only when `locale` is requested: a host that passes none, including every nested player a section mounts (the shell above remains the stamped ancestor), renders what it did before, and the element removes the stamp if the locale it stamped is cleared. The item-demos delivery page gains the `?locale=` param with the generated-tier provider composition, and a new interface-locale spec asserts the standalone stamp, the behaviour preservation, and the mirrored Arabic error banner — closing the RTL layout audit's recorded item-player gap.
