---
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-theme": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-players-shared": patch
---

The answer eliminator's toggle is a round icon button on the shared trigger
tokens and the NDS icon button under `nds-icons`. `strategy` gains `cross`. An
eliminated choice dims its content and is no longer marked `aria-disabled`.
`button-alignment` and `--pie-answer-eliminator-toggle-color` are removed: the
toggle always sits in flow as the choice container's last child, and its
colours come from the `--pie-button-*` and `--pie-tool-trigger-active-*` tokens.
