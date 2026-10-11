# Section Player Instrumentation Debugger

`<pie-section-player-tools-instrumentation-debugger>` is a development panel that
lists the records PIE players send to their instrumentation provider. It is a
debugging tool for player integrations, outside learner-facing delivery; the demo
apps mount it in their debug overlays (`apps/section-demos`,
`apps/assessment-demos`, `apps/item-demos`).

## Usage

Importing the package registers the custom element:

```ts
import "@pie-players/pie-section-player-tools-instrumentation-debugger";
```

```html
<pie-section-player-tools-instrumentation-debugger
  max-records="200"
></pie-section-player-tools-instrumentation-debugger>
```

The panel reads a window-level record stream that
`DebugPanelInstrumentationProvider` (from `@pie-players/pie-players-shared`)
writes to. Configure the player with that provider, usually beside a production
provider in a `CompositeInstrumentationProvider`; without it the panel stays
empty. The section player README's
[Instrumentation](../section-player/README.md#instrumentation) section shows where
the provider is set.

The stream buffers the latest 500 records, so a panel opened after the player
started replays what it missed. Clearing the panel also empties that buffer.

## Attributes and properties

| Property | Attribute | Default | Purpose |
| --- | --- | --- | --- |
| `maxRecords` | `max-records` | `250` | Records kept per kind, clamped to 20–2000. |
| `maxRecordsByKind` | `max-records-by-kind` (JSON) | `{}` | Per-kind caps overriding `maxRecords`. |
| `persistenceScope` | `persistence-scope` | `""` | Layout persistence scope; see [shared panel layout](../section-player-tools-shared/README.md#panel-layout). |
| `persistencePanelId` | `persistence-panel-id` | `instrumentation-events` | Layout persistence id within the scope. |

The record kinds are `event`, `error`, `metric`, `user-context` and
`global-attributes`; the panel filters by kind and can pause recording. The
element dispatches `close` when the panel's close control is used.

## Related documentation

- [Section player integration guide](../../docs/section-player/integration-guide.md)
- [Instrumentation providers](../../docs/architecture/instrumentation-providers.md)
- [Section player architecture](../section-player/ARCHITECTURE.md)
