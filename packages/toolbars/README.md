# PIE Toolbars

Toolbar custom elements used by the section player and assessment toolkit to
render configured tools at item and section scope.

## Usage

Import the root package to register both toolbar elements:

```ts
import "@pie-players/pie-toolbars";
```

Or import a single registration entrypoint:

```ts
import "@pie-players/pie-toolbars/components/item-toolbar-element";
import "@pie-players/pie-toolbars/components/section-toolbar-element";
```

Registered custom elements:

- `<pie-item-toolbar>`
- `<pie-section-toolbar>`

## Related Documentation

- [Tools and accommodations architecture](../../docs/tools-and-accomodations/architecture.md)
- [Tool host contract](../../docs/tools-and-accomodations/tool_host_contract.md)
- [Assessment toolkit README](../assessment-toolkit/README.md)
