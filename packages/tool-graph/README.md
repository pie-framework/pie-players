# Graph Tool

Interactive coordinate-grid graphing tool for PIE assessment player flows.

## Usage

Import the package to register `<pie-tool-graph>`:

```ts
import "@pie-players/pie-tool-graph";
```

```html
<pie-tool-graph visible="true" tool-id="graph"></pie-tool-graph>
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `visible` | `boolean` | `false` | Controls whether the graph tool is visible. |
| `toolId` | `string` | `graph` | Tool identifier used by the assessment toolkit runtime context. |

## Related Documentation

- [Tools and accommodations architecture](../../docs/tools-and-accomodations/architecture.md)
- [Tool provider system](../../docs/tools-and-accomodations/tool_provider_system.md)
