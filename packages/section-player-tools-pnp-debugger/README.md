# Section Player PNP Debugger

`<pie-section-player-tools-pnp-debugger>` is a development panel that shows how
the toolkit's tool policy resolved Personal Needs and Preferences (PNP) inputs,
placement and provider state into tool visibility for a section. It is a
debugging tool for section-player integrations, outside learner-facing delivery;
`apps/section-demos` mounts it in its debug overlays.

## Usage

Importing the package registers the custom element. The panel reads every
decision from the toolkit coordinator's tool policy engine, so the host sets the
section and the coordinator as properties:

```ts
import "@pie-players/pie-section-player-tools-pnp-debugger";
```

```html
<pie-section-player-tools-pnp-debugger
  role-type="candidate"
  editable
></pie-section-player-tools-pnp-debugger>
```

```js
panel.sectionData = section;
panel.toolkitCoordinator = coordinator;
```

The panel recomputes on every `onPolicyChange` notification from the coordinator.
It shows the policy determination (its source, the inputs checked and the runtime
context), the policy diagnostics, and a warning when the section expects an
assessment and none is bound.

## Editing

`editable` adds a tools editor. Its controls change the live coordinator, so the
player under test changes with them:

| Control | Coordinator call |
| --- | --- |
| Placement per level (`section`, `item`, `passage`) | `updateToolsPlacement` |
| Provider enabled | `updateToolConfig(toolId, { enabled })` |
| PNP `supports` and `prohibitedSupports` | `updateAssessment`, editing only the bound assessment's PNP profile |
| PNP enforcement | `setPnpEnforcement`; `auto` clears the override |

## Attributes and properties

| Property | Attribute | Default | Purpose |
| --- | --- | --- | --- |
| `sectionData` | property | required | Section whose item and passage ids the panel evaluates. |
| `roleType` | `role-type` | required | `candidate` or `scorer`, reported in the runtime context. |
| `editable` | `editable` | `false` | Shows the tools editor. |
| `toolkitCoordinator` | property | `null` | Toolkit coordinator whose policy the panel reads and edits. |
| `persistenceScope` | `persistence-scope` | `""` | Layout persistence scope; see [shared panel layout](../section-player-tools-shared/README.md#panel-layout). |
| `persistencePanelId` | `persistence-panel-id` | `pnp-debugger` | Layout persistence id within the scope. |

The element renders without a shadow root and dispatches `close` when the panel's
close control is used.

## Related documentation

- [PNP configuration guide](../assessment-toolkit/docs/PNP_CONFIGURATION.md)
- [Tool provider system](../../docs/tools-and-accomodations/tool_provider_system.md)
- [Section player integration guide](../../docs/section-player/integration-guide.md)
