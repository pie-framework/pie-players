---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-dictionary": patch
"@pie-players/pie-tool-picture-dictionary": patch
"@pie-players/pie-tool-magnifier": patch
"@pie-players/pie-tool-sign-language": patch
---

Every custom element these packages register now has a typed interface and an `HTMLElementTagNameMap` entry, so `document.querySelector("pie-item-scope")` and the like return the element's properties and methods instead of `HTMLElement`. The section player's kernel host, base, shell, passage shell, item and passage cards and the two panes, the toolkit's four elements, the four tools and the assessment player's shell are covered. `check:custom-elements:dist` now fails when a registered tag has no map entry reachable from a package's type entries.
