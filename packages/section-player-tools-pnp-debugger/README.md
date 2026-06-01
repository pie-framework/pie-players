# Section Player PNP Debugger

Debug panel for inspecting Personal Needs and Preferences (PNP) inputs and tool
visibility decisions in section-player flows.

## Usage

Import the package to register `<pie-section-player-tools-pnp-debugger>`:

```ts
import "@pie-players/pie-section-player-tools-pnp-debugger";
```

```html
<pie-section-player-tools-pnp-debugger
  role-type="candidate"
  editable
></pie-section-player-tools-pnp-debugger>
```

Set the `sectionData` and `toolkitCoordinator` properties from host code when
embedding the panel in a real section-player route.

## Related Documentation

- [PNP configuration guide](../assessment-toolkit/docs/PNP_CONFIGURATION.md)
- [Tool provider system](../../docs/tools-and-accomodations/tool_provider_system.md)
- [Section player client architecture tutorial](../../docs/section-player/client-architecture-tutorial.md)
