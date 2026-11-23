---
"@pie-players/pie-theme": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-calculator-geogebra": patch
"@pie-players/pie-calculator-cortex": patch
---

The Desmos, GeoGebra and Cortex calculators follow the active PIE scheme and re-apply it on a scheme switch without a reload (PIE-1576). Desmos inverts its colours on a dark `--pie-background` and takes the calculator series tokens as its graphing palette on a light one. GeoGebra's graphing view takes its background, grid and axis colours from the theme and its border from `--pie-border` at load; its algebra view and keyboard stay light. Cortex's input field takes its caret, selection and highlight colours from the theme, and its card and screen resolve through `--pie-background`. A host's own `invertedColors`, `colors` or `borderColor` setting keeps precedence. The observer and reader the three share are exported from `@pie-players/pie-theme/theme-observer`.

Host A and Host R see their Desmos calculator inverted wherever the `--pie-background` it renders on is dark, and Host S's calculator does too if it is Desmos. No listed host selects Cortex, and none is recorded selecting GeoGebra.
