# @pie-players/pie-tool-calculator-inline-desmos

`<pie-tool-calculator-inline>` is a button for an item header that opens and
closes the calculator the item toolbar renders. It is provider-neutral: the
toolkit's `tools.providers.calculator` picks the adapter, and the `desmos` in
the package name is historical. The button adds no calculator of its own. It
opens the toolbar's `<pie-tool-calculator>`
([`@pie-players/pie-tool-calculator-desmos`](../tool-calculator-desmos/README.md))
through the toolkit's tool request path, so the item's tool policy governs both
and the button and toolbar stay in step. The packaged tool set does not include
this element.

The element has an open shadow root and bundles the shared inline surface from
`@pie-players/pie-tool-calculator-shared`.

## Installation

```bash
bun add @pie-players/pie-tool-calculator-inline-desmos
```

## Usage

The element renders inside `<pie-item-scope>` under `<pie-assessment-toolkit>`:
the toolkit runtime context supplies the tool coordinator and the item shell
supplies the item. Section players provide both.

```ts
import "@pie-players/pie-tool-calculator-inline-desmos";

// itemHeader: an element inside <pie-item-scope>
const calculatorButton = document.createElement("pie-tool-calculator-inline");
calculatorButton.setAttribute("calculator-type", "scientific");
itemHeader.append(calculatorButton);
```

The toolkit's tool configuration places `calculator` in the item toolbar and
names its provider. The button is enabled once the runtime context supplies a
tool coordinator and the target toolbar renders the calculator
(`canRequestTool`). It is disabled while the item's tool policy leaves the
calculator out or the calculator module failed to load, and re-checks when
toolbars register or the policy changes.

## Attributes

| Attribute | Default | Purpose |
| --- | --- | --- |
| `target-tool-id` | `""` | Scoped id of the calculator to toggle, `<toolId>:<section\|item\|passage>:<scopeId>`. Empty resolves the enclosing item's calculator, `calculator:item:<id>` with the item's canonical id, else its id. Set it only to toggle another toolbar's calculator. |
| `calculator-type` | `"basic"` | The type the button requests and names in its label and announcements. A type outside `available-types` falls back to `basic`. |
| `available-types` | `"basic,scientific,graphing"` | Comma-separated types the opened calculator offers, together with `calculator-type`. |
| `size` | `"md"` | `sm`, `md` or `lg`. |

Each attribute has a camelCase property of the same name. When no target
resolves, because the button sits outside an item shell or `target-tool-id` is
not a scoped id, the button stays disabled and logs a console warning after one
second.

## Toggle behavior

1. A click on a closed calculator sends a tool request for the target's tool
   id, level and scope (`requestTool`) with the button's type and available
   types as render params, and the toolbar shows its calculator with them.
2. A click on an open calculator hides it.
3. `aria-pressed` and the active style follow the target's visibility,
   including changes made from the toolbar.

## Accessibility

- A native `<button>` whose `aria-label` and `title` name the calculator type,
  with `aria-pressed` for the open state.
- A polite live region announces each open and close the button makes, per
  calculator type.
- A 2px focus outline with a 2px offset (WCAG 2.4.7).
- Every size is at least 24×24 CSS px (WCAG 2.5.8).
- `prefers-reduced-motion` turns the transitions off.

## Size variants

| Size | Button | Icon |
| --- | --- | --- |
| `sm` | 1.5rem × 1.5rem | 1rem × 1rem |
| `md` (default) | 2rem × 2rem | 1.25rem × 1.25rem |
| `lg` | 2.5rem × 2.5rem | 1.5rem × 1.5rem |

## Styling

| Token | Use | Fallback |
| --- | --- | --- |
| `--pie-button-background-color` | Fill of this control | `--pie-button-bg`, then `--pie-white`, `#fff` |
| `--pie-button-hover-background-color` | Hover fill of this control | `--pie-button-hover-bg`, then `--pie-secondary-background`, `#f5f5f5` |
| `--pie-tool-trigger-active-background` | Open-state fill | `--pie-primary`; on hover `--pie-primary-dark` |
| `--pie-tool-trigger-active-border-color` | Open-state border | `--pie-primary` |
| `--pie-tool-trigger-active-color` | Open-state foreground and icon | White |
| `--pie-border` | Border | `#ccc` |
| `--pie-text` | Foreground | `#333` |
| `--pie-button-focus-outline` | Focus outline | `#0066cc` |
| `--pie-button-hover-color` | Icon on hover while closed | `#667eea` |

The first five are registered `component-public` tokens; the others are
canonical semantic tokens. The fill does not read `--pie-background`, the page
token a host may point at its own backdrop: set `--pie-button-bg` for every
button, or `--pie-button-background-color` for this control alone. Hosts style
the open state through the `--pie-tool-trigger-active-*` tokens, which leave
`--pie-primary` untouched elsewhere, and keep WCAG AA contrast between the
foreground and background they set.
