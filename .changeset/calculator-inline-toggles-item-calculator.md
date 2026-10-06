---
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-tool-calculator-inline-geogebra": patch
"@pie-players/pie-tool-calculator-inline-cortex": patch
"@pie-players/pie-tool-calculator-shared": patch
---

The inline calculator buttons stay visible and open the calculator. Placed
inside `<pie-item-shell>`, a button toggles the item toolbar's calculator,
`calculator:item:<itemId>`; it used to register itself with the tool
coordinator, which hid it, and toggle its own id. `target-tool-id` still names
another calculator id and now defaults to empty on every variant, and the unused
`tool-id` attribute is gone. With no item shell and no `target-tool-id` the
button is disabled and logs a console warning.
