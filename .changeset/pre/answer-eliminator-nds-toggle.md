---
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-theme": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-i18n-generated": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

The answer eliminator's toggle is a round icon button on the shared trigger
tokens and the NDS icon button under `nds-icons`. `strategy` gains `cross`. An
eliminated choice dims its content and is no longer marked `aria-disabled`.
`button-alignment` and `--pie-answer-eliminator-toggle-color` are removed: the
toggle always sits in flow as the choice container's last child, and its
colours come from the `--pie-button-*` and `--pie-tool-trigger-active-*` tokens.
The toggle is named "Eliminate {choice}" in every locale, ends a legacy
multiple-choice row ahead of its rationale, and is absent where a choice cannot
be eliminated, as in evaluate mode. There an eliminated choice keeps its toggle,
pressed and disabled, and a struck legacy multiple-choice choice stays
unselectable when the element re-renders its inputs. The NDS eliminator toggle
and the NDS inline TTS trigger keep their accent when pressed, so
`--pie-tool-trigger-active-color` no longer recolours either.

Strikethrough and cross draw SVG marks in the choice's container, over the
content and outside its dim, so a strike keeps its full colour and reaches
images and MathJax output, and the content's markup stays as the element
rendered it. The Highlight API paint and the
`pie-answer-eliminator-eliminated-fallback`, `pie-answer-eliminator-image-strike*`
and `pie-answer-eliminator-math-strike*` classes are removed. Choices an
element renders after the tool turns on get toggles, turning the tool on again
leaves tracked choices as they are, a strategy change repaints in place with
the tool on or off, and focus follows a re-rendered choice to its new toggle.
Toggles are named from an expression's spoken name and an image's alt text. A
legacy element's session decides which choice is selected, so a shown correct
answer hides no toggle. Every NDS mount bridges `--color-primary-white` to the
button background, and the calculator's and the eliminator's pressed glyphs
default to `--pie-white`.
