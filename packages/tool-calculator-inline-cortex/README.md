# @pie-players/pie-tool-calculator-inline-cortex

Registers `<pie-tool-calculator-inline-cortex>`, an accessible inline toggle
for the bundled open-source calculator.

```ts
import "@pie-players/pie-tool-calculator-inline-cortex";
```

The element renders inside `<pie-item-scope>` under `<pie-assessment-toolkit>`,
as `<pie-tool-calculator-inline>` from
`@pie-players/pie-tool-calculator-inline-desmos` does, and takes the same
attributes. It toggles the calculator the item toolbar renders for the
enclosing item, `calculator:item:<itemId>`, so the toolkit's tool
configuration must place `calculator` in the item toolbar with the
`calculator-cortex` provider. The button is enabled while that toolbar renders
the calculator under its policy. `target-tool-id` names another toolbar's
calculator by its scoped id. Without an item shell or a valid `target-tool-id`
the button stays disabled and logs a console warning.
