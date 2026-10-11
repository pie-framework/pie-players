# @pie-players/pie-tool-graph

The graph tool (`graph`): a coordinate grid on which a learner plots points and
joins them with lines, as scratch work beside math content. It registers
`<pie-tool-graph>`. The tool records nothing as a response.

## Installation

```bash
bun add @pie-players/pie-tool-graph
```

## Usage

The packaged tool set registers the tool as `graph` and loads the element on
demand; hosts place it through `tools.placement`. It supports the section level,
and the item level where the toolkit runs without a section; the section
toolbar is its recommended placement. The toolbar offers it only where the
content contains math. It opens in a resizable overlay, 920×680px initially and
at least 640×500px. A host that registers the element itself imports the
package:

```ts
import "@pie-players/pie-tool-graph";
```

| Property | Attribute | Default | Purpose |
| --- | --- | --- | --- |
| `visible` | `visible` | `false` | Shows the tool. `"false"`, `"0"`, `"off"` and `"no"` read as false. |
| `toolId` | `tool-id` | `"graph"` | Tool instance id, set on the dialog as `data-pie-tool-id`. |

The element has an open shadow root and takes its interface locale from the
toolkit runtime context.

## Modes

| Mode | Pointer | Keyboard |
| --- | --- | --- |
| Select | Drags a point. | — |
| Point | Places a point where clicked. | Enter or Space places a point at the cursor. |
| Line | Joins two clicks with a line; a click within one minor cell of a point reuses it, otherwise it places a new point. | Enter or Space at the cursor, or on a focused point, starts or completes a line. |
| Delete | Removes the point under the click and its lines. | Enter or Space on a focused point removes it. |

A line never joins a point to itself or duplicates an existing line. Changing
mode cancels a line in progress.

## Grid and keyboard

The grid has five major rows, each divided into a 5×5 minor grid, and widens
with the overlay. A slider sets the grid's opacity from 0 to 1.

The canvas is focusable. Arrow keys move a keyboard cursor one minor-grid step,
starting from the canvas center and snapped to minor intersections; pointer
placement is not snapped. Each point is focusable on its own.

## State

Points and lines live in the element and are not written to the tool-state
store. The toolkit reuses the element while the tool stays in the same scope, so
they survive closing and reopening it; a section change starts them over, as
[Lifetimes and scope consequences](../../docs/tools-and-accomodations/architecture.md#lifetimes-and-scope-consequences)
describes.

## Styling

The tool reads the canonical semantic tokens `--pie-background`, `--pie-white`,
`--pie-text`, `--pie-border-light`, `--pie-border-dark`, `--pie-primary`,
`--pie-primary-light`, `--pie-primary-dark`, `--pie-correct`, `--pie-missing`,
`--pie-missing-icon` and `--pie-button-focus-outline`.

## Related documentation

- [Tools and accommodations architecture](../../docs/tools-and-accomodations/architecture.md)
- [Tool provider system](../../docs/tools-and-accomodations/tool_provider_system.md)
