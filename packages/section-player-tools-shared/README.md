# Section Player Tools Shared

Shared panel UI and helper utilities for the section-player debugger packages.
This package is not a custom element by itself; it provides building blocks used
by the event, PNP, session, TTS settings, and instrumentation debugger panels.

## Usage

```ts
import {
  SharedFloatingPanel,
  getSectionControllerFromCoordinator,
} from "@pie-players/pie-section-player-tools-shared";
```

## Consumers

- `@pie-players/pie-section-player-tools-event-debugger`
- `@pie-players/pie-section-player-tools-pnp-debugger`
- `@pie-players/pie-section-player-tools-session-debugger`
- `@pie-players/pie-section-player-tools-tts-settings`
- `@pie-players/pie-section-player-tools-instrumentation-debugger`

## Related Documentation

- [Section player architecture](../section-player/ARCHITECTURE.md)
- [Section player client architecture tutorial](../../docs/section-player/client-architecture-tutorial.md)
