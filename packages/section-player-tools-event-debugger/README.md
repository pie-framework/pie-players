# Section Player Event Debugger

`<pie-section-player-tools-event-debugger>` is a development panel that lists a
section controller's events as they arrive. It is a debugging tool for
section-player integrations, outside learner-facing delivery; the demo apps mount
it in their debug overlays (`apps/section-demos`, `apps/assessment-demos`).

## Usage

Importing the package registers the custom element. The panel reads events
through the toolkit coordinator, so set the `toolkitCoordinator` property along
with the section and attempt the panel follows:

```ts
import "@pie-players/pie-section-player-tools-event-debugger";
```

```html
<pie-section-player-tools-event-debugger
  section-id="section-1"
  attempt-id="attempt-1"
></pie-section-player-tools-event-debugger>
```

The panel subscribes through `subscribeItemEvents` and
`subscribeSectionLifecycleEvents` once the coordinator holds a controller for
`section-id` and `attempt-id`, and subscribes again when that controller is
disposed and replaced. On each subscription it records the controller's current
completion and loading state, so a panel opened mid-session starts populated.

## Attributes and properties

| Property | Attribute | Default | Purpose |
| --- | --- | --- | --- |
| `toolkitCoordinator` | property | `null` | Toolkit coordinator whose controller events the panel lists. |
| `sectionId` | `section-id` | `""` | Section of the controller to follow. |
| `attemptId` | `attempt-id` | unset | Attempt of the controller to follow. |
| `maxEvents` | `max-events` | `200` | Records kept per level, clamped to 10–2000. |
| `maxEventsByLevel` | `max-events-by-level` (JSON) | `{}` | Per-level caps, `{ item?, section? }`, overriding `maxEvents`. |
| `persistenceScope` | `persistence-scope` | `""` | Layout persistence scope; see [shared panel layout](../section-player-tools-shared/README.md#panel-layout). |
| `persistencePanelId` | `persistence-panel-id` | `controller-events` | Layout persistence id within the scope. |

The element dispatches `close` when the panel's close control is used; the host
removes or hides it.

## Recorded events

The panel splits records into two levels, each with its own tab and cap:

| Level | Events |
| --- | --- |
| Item | `item-session-data-changed`, `item-session-meta-changed`, `item-selected`, `content-loaded`, `item-player-error`, `item-complete-changed` |
| Section | `section-navigation-change`, `section-loading-complete`, `section-items-complete-changed`, `section-error` |

Consecutive identical events collapse into one row with a repeat count. Pause
stops recording and clear empties the list. The events themselves are specified
in the integration guide's
[controller events](../../docs/section-player/integration-guide.md#9-controller-events-and-subscriptions).

## Related documentation

- [Section player integration guide](../../docs/section-player/integration-guide.md)
- [Framework-owned error handling](../../docs/tools-and-accomodations/framework-owned-error-handling.md)
