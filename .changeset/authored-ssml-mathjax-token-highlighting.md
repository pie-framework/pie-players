---
"@pie-players/pie-assessment-toolkit": patch
---

Read-aloud from an authored `spoken` catalog card now highlights MathJax-typeset
math token by token, as it already did for native MathML and generated speech.
Before, each spoken math word highlighted a blank spot in the text before the
equation. Equations whose layout cannot be tracked per token (fractions,
radicals, tables) highlight as one block.
