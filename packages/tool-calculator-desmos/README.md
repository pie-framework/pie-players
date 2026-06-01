# Desmos Calculator Tool

Calculator custom element backed by the Desmos provider for PIE assessment
player flows.

## Usage

Import the package to register `<pie-tool-calculator>`:

```ts
import "@pie-players/pie-tool-calculator-desmos";
```

```html
<pie-tool-calculator
  visible="true"
  tool-id="calculator"
  calculator-type="scientific"
></pie-tool-calculator>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `visible` | `boolean` | `false` | Controls whether the calculator is visible. |
| `toolId` | `string` | `calculator` | Tool identifier used by the assessment toolkit runtime context. |
| `calculatorType` | `string` | package default | Requested calculator mode. |
| `availableTypes` | `string[]` | package default | Calculator modes the host allows. |
| `toolkitCoordinator` | `ToolkitCoordinator` | unset | Optional coordinator reference for toolkit-managed flows. |

## Related Documentation

- [Calculator tools README](../assessment-toolkit/src/tools/calculators/README.md)
- [Tools and accommodations architecture](../../docs/tools-and-accomodations/architecture.md)
