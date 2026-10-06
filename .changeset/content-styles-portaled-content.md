---
"@pie-players/pie-theme": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-section-player": patch
---

`components.css` rules keyed on KDS classes, MathJax output or legacy content
classes such as `.frac` and `.noprint` apply document-wide again, so authored
markup an element portals to `<body>`, such as an inline-dropdown's choices,
keeps its KDS fractions and MathJax glyph fixes. Bare tag and framework-class
rules stay inside `[data-pie-content]`.
