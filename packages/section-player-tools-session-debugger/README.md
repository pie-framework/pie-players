# Section Player Session Debugger

Debug panel for inspecting section session state in section-player flows.

## Usage

Import the package to register `<pie-section-player-tools-session-debugger>`:

```ts
import "@pie-players/pie-section-player-tools-session-debugger";
```

```html
<pie-section-player-tools-session-debugger
  section-id="section-1"
  attempt-id="attempt-1"
></pie-section-player-tools-session-debugger>
```

Set the `toolkitCoordinator` property from host code so the panel can resolve
the active section controller and session state.

## Related Documentation

- [Section controller ownership](../section-player/ARCHITECTURE.md#controller-ownership)
- [Section player integration guide](../../docs/section-player/integration-guide.md)
