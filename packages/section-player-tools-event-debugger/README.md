# Section Player Event Debugger

Runtime event debugger panel for section-player and assessment-toolkit event
streams.

## Usage

Import the package to register `<pie-section-player-tools-event-debugger>`:

```ts
import "@pie-players/pie-section-player-tools-event-debugger";
```

```html
<pie-section-player-tools-event-debugger
  section-id="section-1"
  attempt-id="attempt-1"
></pie-section-player-tools-event-debugger>
```

Set the `toolkitCoordinator` property when using the panel in a host-managed
toolkit flow.

## Related Documentation

- [Section player client architecture tutorial](../../docs/section-player/client-architecture-tutorial.md)
- [Framework-owned error handling](../../docs/tools-and-accomodations/framework-owned-error-handling.md)
