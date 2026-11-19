---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

A markup custom-element tag that `elements` does not declare and no model
references is a config-contract warning instead of an error, so items that
carry one, such as a leftover rubric tag, render again in the item and section
players. The item player removes such tags from its runtime copy of the markup
and keeps their content, through the new `removeUndeclaredMarkupTags`, so an
undeclared tag never upgrades an element another item registered. A model whose
element is undeclared still fails validation.
