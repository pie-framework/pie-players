# PIE Players Theme Language

This context names the theming concepts shared by PIE Players and its runtime
hosts so palette behavior and ownership can be discussed consistently.

## Language

**Theme Token**:
A `--pie-*` custom property whose meaning and ownership are recorded in the theme token registry.
_Avoid_: CSS variable, color variable

**Base Theme**:
The complete PIE light or dark token set selected by the `theme` setting, with `auto` selecting between them.
_Avoid_: Default palette, color scheme

**Theme Provider**:
A mapping from a runtime host's design-system values into PIE theme tokens.
_Avoid_: Theme, palette

**Built-in Color Scheme**:
A PIE-owned, complete accessibility palette that replaces every required participating color token. Optional component hooks continue to inherit from the provider when the built-in does not define them.
_Avoid_: Theme, partial overlay

**Registered Custom Scheme**:
A runtime-host-owned partial token overlay with registry metadata and picker discovery.
_Avoid_: Built-in scheme, CSS-only scheme

**CSS-only Scheme**:
A runtime-host-owned, best-effort scheme applied through `data-color-scheme` selectors without registration metadata or managed cascade precedence. It follows the normal cascade in a stylesheet-only integration; a selector competing with a mounted `<pie-theme>` needs `!important` to override its inline managed tokens.
_Avoid_: Registered custom scheme

**Default Scheme**:
The absence of a selected named color scheme, leaving the base theme and provider result in effect.
_Avoid_: Default color palette

**Requested Scheme**:
The color-scheme identifier selected by a runtime host or learner, retained even while no matching registered definition is available.
_Avoid_: Active palette, resolved scheme

**Resolved Scheme**:
The registered built-in or custom scheme currently supplying managed token values for a requested identifier.
_Avoid_: Requested scheme, CSS-only scheme

**Scheme Participation**:
A theme token's classification as required, optional, or excluded for built-in color schemes.
_Avoid_: Token support

**Scheme Preview**:
A picker swatch projected from a scheme resolved over PIE's canonical light Base Theme. It is catalog metadata, not a promise to mirror a host-specific provider or dark Base Theme.
_Avoid_: Authored preview colors, palette thumbnail metadata

**Explicit Theme Override**:
A runtime-host-supplied token value applied after the base theme, provider, and registered scheme.
_Avoid_: Provider value, scheme value

## Relationships

- A **Base Theme** establishes the complete starting token set.
- A **Theme Provider** may replace tokens from the **Base Theme** with runtime-host design-system values.
- A selected **Built-in Color Scheme** replaces every required participating color token after provider resolution.
- A selected **Registered Custom Scheme** partially overlays the resolved tokens after provider resolution.
- An **Explicit Theme Override** has final precedence over the resolved registered theme values.
- A **CSS-only Scheme** remains available as a deliberate host CSS selector hook. It has normal cascade precedence in a stylesheet-only integration and needs `!important` when competing with a mounted `<pie-theme>`; a **Registered Custom Scheme** is the supported path for managed precedence and discovery.
- A built-in scheme identifier is reserved and cannot identify a **Registered Custom Scheme**.
- A **Requested Scheme** without a **Resolved Scheme** retains its identifier while managed rendering falls back to the base theme and provider result.
- A **Scheme Preview** is derived from the same canonical definitions that render the assessment and is never a separately authored palette.

## Example dialogue

> **Dev:** "Does `default` select the light accessibility palette?"
> **Domain expert:** "No. The **Default Scheme** selects no named palette; the **Base Theme** still decides light or dark, then the **Theme Provider** may adapt it."

## Flagged ambiguities

- "theme" previously referred to both light/dark selection and accessibility palettes — resolved: use **Base Theme** for light/dark and **Color Scheme** for a named accessibility palette.
- "custom scheme" previously covered both registered data and host CSS selectors — resolved: distinguish **Registered Custom Scheme** from **CSS-only Scheme**.
- "complete palette" does not mean every non-color token — completeness is defined by **Scheme Participation**.
