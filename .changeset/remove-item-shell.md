---
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-theme": patch
"@pie-players/pie-tool-calculator-shared": patch
---

`<pie-item-shell>` is removed. Section-player item cards render `<pie-item-scope>`, the toolkit's item element, which now takes `region-policy`; `data-pie-shell-root="item"` and the card's classes are unchanged, so a host selecting the tag selects `pie-item-scope` instead. The theme's font-size rules scale `pie-item-scope`, around a host's own item player too.
