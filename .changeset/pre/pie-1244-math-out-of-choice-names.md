---
"@pie-players/pie-assessment-toolkit": patch
---

Leave math unlabelled in a control named by `aria-labelledby` from elements that do not hold it (PIE-1244). multiple-choice names a choice holding math from its key and a note, "A. Pick the answer below", so the screen reader reads the formula's MathML in the content, where the student can explore it and a braille display shows it as math. The toolkit's spoken label on that formula was read in browse mode instead, and reached a braille display as words.
