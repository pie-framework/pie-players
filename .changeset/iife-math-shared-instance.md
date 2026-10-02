---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

IIFE math no longer nests on re-render when a legacy element bundle shares the
page (PIE-1142). Installing the default math renderer now also creates the
MathJax 3 instance that every copy of `@pie-lib/math-rendering` typesets
through, so a bundled copy without the assistive-MathML guard, such as the one
in `@pie-element/multiple-choice` 9.9.1, can no longer create it. A renderer set
with `setMathRenderer`, or an instance already on the page, is left alone.
