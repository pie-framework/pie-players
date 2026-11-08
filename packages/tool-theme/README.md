# @pie-players/pie-tool-theme

The color-scheme tool (`theme`): a picker in which a learner chooses one of the
color schemes in the `@pie-players/pie-theme` catalog. It registers
`<pie-tool-theme>` and changes the `scheme` of the `<pie-theme>` element that
hosts the player. Theming itself, the tokens, base themes and `<pie-theme>`,
belongs to [`@pie-players/pie-theme`](../theme/README.md). The picker addresses
the WCAG 2.2 Level AA color, contrast, focus and keyboard requirements.

## Installation

```bash
bun add @pie-players/pie-tool-theme
```

## Usage

The packaged tool set registers the tool as `theme` and loads the element on
demand; hosts place it through `tools.placement`. It supports the assessment
and section levels, and the section toolbar is its recommended placement. It
opens in a fixed-size overlay, 520×380px initially and at least 420×300px. A
host that registers the element itself imports the package:

```ts
import "@pie-players/pie-tool-theme";
```

| Property | Attribute | Default | Purpose |
| --- | --- | --- | --- |
| `visible` | `visible` | `false` | Shows the picker. `"false"`, `"0"`, `"off"` and `"no"` read as false. |
| `toolId` | `tool-id` | `"theme"` | The id the tool registers under with the tool coordinator. |

The element has an open shadow root and takes its tool coordinator and
interface locale from the toolkit runtime context.

## Scheme selection

The picker lists every scheme in the shared catalog and follows registrations
and unregistrations as they happen. Previews come from the catalog; a custom
scheme's preview resolves against PIE's light base on an opaque swatch.

Choosing a scheme sets `scheme` on the theme host and closes the tool. The theme
host is the nearest `<pie-theme>` ancestor, searched across shadow roots, else
`<pie-theme scope="document">`, else the first `<pie-theme>` in the document.
With no `<pie-theme>` at all, the picker sets `data-color-scheme` on the
document element. The picker writes nothing to `localStorage`.

Until a learner chooses, the picker shows the host's scheme, and it re-reads the
host each time it opens. A chosen custom scheme that is no longer registered
stays selected, labeled unavailable with a status message, and is listed as
available again once registered.

## Learner choice

The picker records the choice in the toolkit's `elementToolStateStore` under
tool id `theme`, keyed by assessment, section and attempt, and reapplies it when
the tool mounts again in that section attempt. Without a store, an
`assessmentId` or a `sectionId` in the runtime context, the choice lasts only on
the theme host. Nothing is kept for the device, so one learner's choice never
overrides the scheme a host sets for the next. The host persists the store as
[State persistence pattern](../../docs/tools-and-accomodations/architecture.md#state-persistence-pattern)
describes.

## Custom schemes

Hosts register custom schemes globally with `registerPieColorSchemes` from
`@pie-players/pie-theme`
([Registered custom schemes](../theme/README.md#registered-custom-schemes)).
Every mounted picker observes the same immutable catalog; there are no
per-element catalogs. Scheme names and descriptions come from the registration,
so the party that registers a scheme localizes them.

## Keyboard and focus

The picker is a dialog that traps focus while visible. With the scheme menu
open, ArrowDown and ArrowUp move between schemes, Escape closes the menu and
returns focus to its trigger, and a click outside closes it.

## Styling

The picker reads the canonical semantic tokens `--pie-background`, `--pie-text`,
`--pie-border`, `--pie-button-bg`, `--pie-button-border`, `--pie-button-color`,
`--pie-button-hover-bg`, `--pie-button-hover-border`, `--pie-button-hover-color`,
`--pie-button-active-bg` and `--pie-button-focus-outline`.
