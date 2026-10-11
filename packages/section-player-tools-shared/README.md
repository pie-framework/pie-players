# Section Player Tools Shared

Shared panel UI and helpers for the section-player debugging panels. It
registers no custom element. The event, PNP, session and instrumentation
debugger packages build on it, and the demo apps (`apps/section-demos`,
`apps/assessment-demos`) use its toggles and session database panel directly.
Like the panels, it is development tooling, outside learner-facing delivery.

## Usage

```ts
import {
  SharedFloatingPanel,
  getSectionControllerFromCoordinator,
} from "@pie-players/pie-section-player-tools-shared";
```

## Panel layout

`SharedFloatingPanel` is the window every debugger panel renders in: dragged by
its header, resized from its corner, and minimized or closed from its window
controls. Dragging, resizing and restoring keep it inside the viewport, and
pressing its header brings it in front of the other panels.

A panel persists its position, size and minimized state to `localStorage` under
`pie:debug-panels:v1:<persistenceScope>:<persistencePanelId>:layout`, and
restores them on mount. Persistence is on only when both `persistenceScope` and
`persistencePanelId` are non-empty. Each debugger panel defaults the panel id and
leaves the scope empty, so the host turns persistence on by setting
`persistence-scope`.

## Exports

| Export | Purpose |
| --- | --- |
| `SharedFloatingPanel` | Draggable, resizable floating panel with persisted layout. |
| `PanelWindowControls`, `PanelResizeHandle` | The floating panel's minimize and close controls, and its resize handle. |
| `DebugPanelToggles` | Toolbar buttons that show and hide the session, event, database and instrumentation panels. |
| `SessionDbPanel` | Panel over the demo apps' session database API (`/api/session-demo` by default). |
| `createFloatingPanelPointerController`, `computePanelSizeFromViewport`, `claimNextFloatingPanelZIndex` | Drag and resize handling, initial sizing from the viewport, and stacking order. |
| `getSectionControllerFromCoordinator`, `isMatchingSectionControllerLifecycleEvent`, `optionalIdsEqual` | Section controller lookup by section and attempt id, and lifecycle event matching. |
| `createSectionControllerSubscriptionManager` | Keeps a panel subscribed to one section controller and resubscribes when the coordinator disposes and replaces it. |

The components are Svelte, compiled into the bundle and typed `any` in the
published declarations. The package also exports the types
`FloatingPanelPointerController`, `FloatingPanelState`,
`FloatingPanelViewportSizing`, `SectionControllerKeyLike`,
`SectionControllerLifecycleEventLike`, `ToolkitCoordinatorWithSectionController`
and `SectionControllerSubscriptionHandlers`.

## Consumers

- `@pie-players/pie-section-player-tools-event-debugger`
- `@pie-players/pie-section-player-tools-pnp-debugger`
- `@pie-players/pie-section-player-tools-session-debugger`
- `@pie-players/pie-section-player-tools-instrumentation-debugger`

## Related documentation

- [Section player architecture](../section-player/ARCHITECTURE.md)
- [Section player integration guide](../../docs/section-player/integration-guide.md)
