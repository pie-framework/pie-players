# @pie-players/pie-tool-calculator-desmos

A compatibility entry that registers `<pie-tool-calculator>`, the assessment
toolkit's provider-neutral calculator element. Importing it has the same effect
as importing `@pie-players/pie-tool-calculator-shared/calculator-element`; the
`desmos` in the name is historical. The element mounts whichever adapter the
toolkit's `tools.providers.calculator` selects, [Desmos](../calculator-desmos/README.md),
[GeoGebra](../calculator-geogebra/README.md) or [Cortex](../calculator-cortex/README.md),
as [Calculator providers](../default-tool-loaders/README.md#calculator-providers)
describes.

The toolkit's packaged tool set loads the same element on demand and skips the
load when the tag is already defined, so a toolkit host needs this package only
to register the element ahead of that load, for example in an eager bundle.

## Installation

```bash
bun add @pie-players/pie-tool-calculator-desmos
```

## Usage

```ts
import "@pie-players/pie-tool-calculator-desmos";
```

The toolkit's calculator registration creates the element in the item toolbar's
overlay and sets its type, allowed types and `calculatorConfig`. A host that
places the element itself puts it inside a section or item player running the
toolkit: the element reads the toolkit runtime context and mounts nothing
without a toolkit coordinator.

```html
<pie-tool-calculator
  visible
  tool-id="calculator"
  calculator-type="scientific"
></pie-tool-calculator>
```

## Attributes and properties

| Property | Attribute | Default | Purpose |
| --- | --- | --- | --- |
| `visible` | `visible` | `false` | Mounts the calculator while true and destroys it when false. `"false"`, `"0"`, `"off"` and `"no"` read as false. |
| `toolId` | `tool-id` | `"calculator"` | Tool instance id. The element resolves the provider under its base tool id, the id without the toolkit's `:<level>:<scopeId>` suffix. |
| `calculatorType` | `calculator-type` | `"basic"` | `basic`, `scientific` or `graphing`. A type outside `availableTypes` falls back to the first allowed type. |
| `availableTypes` | `available-types` | All three types | Allowed types. The attribute takes a JSON array; the property also accepts a comma-separated string. Unknown values are dropped. |
| `calculatorConfig` | — | `{}` | `CalculatorProviderConfig` passed to `createCalculator()`. The toolkit sets it from the calculator tool config: `settings`, `restrictedMode`, `locale` and `theme`. |

## Behavior

The element renders without a shadow root. On mount it calls the toolkit
coordinator's `ensureProviderReady()` for the base tool id, creates a provider
instance, and creates the calculator in its container. A change to the tool id,
effective type or `calculatorConfig` remounts the calculator, and so does a tool
config update that replaces the provider. When the provider declares an
attribution, the element renders it as a link below the calculator. A failed
mount shows "Calculator failed to initialize." with the error message.

The element does not persist calculator state; hiding it destroys the
calculator. Hosts that save and restore state drive an adapter directly through
the [`@pie-players/pie-calculator`](../calculator/README.md) contract.

## Exports

The entry exports the type `CalculatorType` from `@pie-players/pie-calculator`.

## Related documentation

- [Calculator providers](../default-tool-loaders/README.md#calculator-providers)
- [`@pie-players/pie-tool-calculator-inline-desmos`](../tool-calculator-inline-desmos/README.md),
  the item-header button that opens this calculator
- [Tools and accommodations architecture](../../docs/tools-and-accomodations/architecture.md)
