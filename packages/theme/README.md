# @pie-players/pie-theme

Shared PIE theming primitives and the `<pie-theme>` custom element. This README
is the API reference for host integrators and component authors.
[How theming works](../../docs/theming/how-theming-works.md) explains the model
behind it: why a host stylesheet cannot override a mounted element, what the
provider choice decides, and how a host carries an accommodation into its own
chrome.

`<pie-theme>` merges four layers, each overwriting the tokens the one before it
set: the base theme, provider adapter output, the resolved color scheme and
explicit `variables`
([resolution order](../../docs/theming/how-theming-works.md#resolution-order)).

Base themes and built-in color schemes are authored once in TypeScript. The
runtime resolver and the checked-in CSS adapters use those same definitions, so
the managed custom-element path and the stylesheet-only path cannot carry
different palettes.

`--pie-surface` is a registered, public `canonical-semantic` token for raised
surfaces such as answer pools and inline TTS panels. Its scheme participation is
`required`: it has values in both base themes, every built-in scheme and the
DaisyUI adapter. It is distinct from the page role `--pie-background`, and text
and controls on it must keep their contrast. Hosts override it through
`variables`, or through the normal cascade in stylesheet-only delivery.

Contents:

- Integration: [entrypoints and styles](#entrypoints-and-styles),
  [custom element interface](#custom-element-interface),
  [provider adapter API](#provider-adapter-api),
  [DaisyUI integration](#daisyui-integration),
  [runtime theme interface](#runtime-theme-interface),
  [registered custom schemes](#registered-custom-schemes),
  [font size scaling](#font-size-scaling), [token registry](#token-registry)
- Palettes: [SC scheme parity](#sc-scheme-parity),
  [fixed hues](#fixed-hues)
- Component authors: [light DOM and shadow DOM](#light-dom-and-shadow-dom),
  [style ownership](#style-ownership), [generated CSS](#generated-css)

The [theme token inventory](../../docs/architecture/pie-727-theme-token-inventory.md)
classifies the token surface, the
[theming WCAG matrix](../../docs/architecture/pie-727-theming-wcag-matrix.md)
records per-surface accessibility coverage, and the
[broad theming contract](../../docs/prds/pie-727-broad-theming-contract.md) is the
design record.

## Entrypoints and styles

Importing the package root registers `<pie-theme>`:

```ts
import "@pie-players/pie-theme";
import "@pie-players/pie-theme/tokens.css";
import "@pie-players/pie-theme/color-schemes.css";
import "@pie-players/pie-theme/font-sizes.css";
```

The lower-level element entrypoint is intentionally side-effect-free:

```ts
import { definePieTheme } from "@pie-players/pie-theme/theme-element";

definePieTheme();
```

Both behaviors are part of the package contract: the root entrypoint registers
the element on import, and `theme-element` registers nothing until
`definePieTheme()` runs.

The four stylesheet artifacts are available at both their package export and
literal `dist` paths:

- `tokens.css`
- `color-schemes.css`
- `font-sizes.css`
- `components.css`

They are unlayered, so in stylesheet-only delivery a host overrides public
tokens through normal source order, specificity or `!important`. The base-theme
adapter wraps its element-name selectors in `:where(...)`, below the specificity
of a later `[data-color-scheme]` rule, so in a stylesheet-only integration a
host scheme overrides the generated base theme through the normal cascade
without `!important`.

```html
<pie-theme theme="auto" scope="document">
  <pie-section-player-splitpane></pie-section-player-splitpane>
</pie-theme>
```

## Custom element interface

| Attribute | Values | Default |
| --- | --- | --- |
| `theme` | `light`, `dark` or `auto`; any other id resolves to the light base | `light` |
| `scope` | `self` or `document` | `self` |
| `provider` | a provider id, `auto` or `none` | `auto` |
| `scheme` | a requested color-scheme id | `default` |
| `variables` | JSON object of CSS custom-property overrides | none |

Each attribute has a property of the same name; the `variables` property takes
an object.

`default` means no named color scheme; the base theme and provider still apply.

For any other `scheme` value, the requested and resolved scheme are separate
states. An id with no registered definition stays in both `scheme` and
`data-color-scheme`, the element renders the base and provider result plus any
explicit `variables`, and a matching custom scheme registered later takes effect
with no change to the markup.

A mounted `<pie-theme>` writes its resolved tokens inline, so a host selector
keyed on the retained `data-color-scheme` competes with them only through
`!important`. A scheme that needs managed precedence is registered instead
([registered custom schemes](#registered-custom-schemes)). In a stylesheet-only
integration, with no mounted `<pie-theme>`, such a selector follows the normal
cascade.

## Provider Adapter API

```ts
import {
  registerPieThemeProvider,
  type ThemeProviderAdapter,
} from "@pie-players/pie-theme";

const myProvider: ThemeProviderAdapter = {
  id: "district-theme",
  canRead: (target) => Boolean(getComputedStyle(target).getPropertyValue("--district-primary").trim()),
  read: (target) => ({
    "--pie-primary": getComputedStyle(target).getPropertyValue("--district-primary").trim(),
  }),
};

registerPieThemeProvider(myProvider);
```

Every copy of this package on a page shares one provider registry, held on
`window.PIE_THEME_PROVIDERS`. A host and a remote that bundle their own copies
register into it alike, and `<pie-theme>` sees each provider whichever copy
defined the element.

## DaisyUI Integration

- With `provider="auto"`, `pie-theme` uses the built-in `daisyui` provider adapter when DaisyUI tokens are present on the target scope.
- `provider="none"` (`PIE_THEME_PROVIDER_NONE`) resolves no provider at all, leaving this package's shipped defaults. It reproduces the palette a host had before adopting a provider, and is the first check when colors differ between two environments.
- `DAISYUI_PIE_TOKEN_MAP` is the adapter's sole source. [How theming works](../../docs/theming/how-theming-works.md#provider-adapters) gives the reason the integration is an adapter, and [Token namespaces](../../docs/theming/how-theming-works.md#token-namespaces) shows how a host on another token vocabulary aliases its names to `--pie-*`.

## Runtime theme interface

The package exposes four operations:

```ts
resolvePieTheme(input): ThemeResolution
listPieColorSchemes(): ColorSchemeSnapshot
observePieColorSchemes(listener): Unsubscribe
registerPieColorSchemes(entries): RegistrationReceipt
```

`resolvePieTheme()` accepts `baseTheme` (`light` or `dark`),
`requestedScheme`, `providerVariables`, and final `variables`. Its result
contains `baseTheme`, `requestedScheme`, `resolvedScheme` (the descriptor, or
`null`), `status` (`default`, `built-in`, `custom`, or `unavailable`), the final
immutable `variables`, `colorScheme` (the CSS `color-scheme` keyword the
resolution implies, `null` without a scheme), and `diagnostics`.

`listPieColorSchemes()` returns an immutable snapshot whose `schemes` list keeps
the built-in order and starts with the `default` descriptor. Each descriptor's
`preview` is the scheme resolved over PIE's canonical light base and projected
to `--pie-background`, `--pie-text` and `--pie-primary`. Previews are derived
from the scheme, never separately authored, and do not mirror a host-specific
provider.

A preview keeps only colors it can render opaque and deterministically:

- Kept: named colors, three- or six-digit hex, non-alpha `rgb()`, `hsl()`,
  `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, and standard CSS Color 4
  `color()` spaces.
- Replaced by the canonical opaque preview swatch: transparent, explicit-alpha,
  relative, nested, context-dependent, malformed or unsupported forms, so a
  preview never inherits colors from the picker itself.

The fallback changes only the preview; the scheme's variable keeps its authored
value.

`observePieColorSchemes()` calls the listener immediately with the current
snapshot, then once after each successful catalog-changing registration or
unregistration. Listener failures are isolated, and a reentrant mutation
produces a later coherent snapshot without interrupting the current
notification.

## Registered custom schemes

Register consumer-defined schemes without modifying framework source:

```ts
import { registerPieColorSchemes } from "@pie-players/pie-theme";

const registration = registerPieColorSchemes([
  {
    id: "district-high-contrast",
    name: "District High Contrast",
    description: "District accessibility palette",
    variables: {
      "--pie-background": "#000000",
      "--pie-text": "#ffffff",
      "--pie-primary": "#00ffff",
    },
  },
]);

// Removes only this registration. Safe to call more than once.
registration.unregister();
```

Then activate with `scheme="district-high-contrast"` on `pie-theme`.

Registered custom schemes are partial overlays. Each entry validates atomically
against the token registry's scheme-participation metadata; an invalid entry is
rejected without dropping valid sibling entries. Built-in ids, `default`,
unknown tokens, and excluded, private and legacy tokens cannot be registered.
The latest valid registration for a custom id wins, and an older receipt cannot
remove that newer definition.

Validation returns structured diagnostics and warns concisely by default; it
does not throw for ordinary invalid input. Contrast diagnostics inspect the
affected semantic relationships in the fully resolved custom palette and stay
non-blocking, because that palette is host-owned.

Use the final `variables` property for deliberate per-instance overrides, and a
CSS selector keyed by `data-color-scheme` only for a deliberate CSS-only scheme,
at the cascade cost the [custom element interface](#custom-element-interface)
sets out.

## SC scheme parity

SC offers 15 schemes. Four are built in here — Black on White, White on
Black, Black on Rose, Yellow on Blue — and the other eleven are host palettes a
program registers itself, from these values:

| SC token | Value |
| --- | --- |
| blue | `#0028a1` |
| red | `#bf0d00` |
| green | `#008272` |
| yellow | `#ffe072` |
| light gray | `#c0c3cf` |
| dark gray | `#9297a6` |
| rose | `#f8d1ce` |

All 15 clear 4.5:1 for ordinary text; Green on White is the tightest at 4.73:1.
The light base chose every semantic color against white, so what an overlay has
to carry beyond ordinary text scales with how far its background sits from
white:

| Background | Tokens | Why |
| --- | --- | --- |
| white | 3 | ink, page, and the select-text hover fill (`--pie-blue-grey-300`), which the light base chose for black ink |
| white, with a mid-tone ink | 6 | the ink misses the tinted recessed and raised surfaces |
| `#000000` | 20 | inverted page; borrow the dark base theme's inks and control family |
| mid-tone (blue, red, green, dark gray) | 27 in White on Blue | neither light nor dark inks hold throughout, so icons, boundaries and focus rings are re-chosen too |

```ts
registerPieColorSchemes([
  {
    id: "sc-blue-on-white",
    name: "Blue on White",
    variables: {
      "--pie-text": "#0028a1",
      "--pie-background": "#ffffff",
      "--pie-blue-grey-300": "#75a2ff",
    },
  },
]);
```

[`tests/schoolcity-scheme-registration.test.ts`](./tests/schoolcity-scheme-registration.test.ts) carries a validated
palette for one scheme of each cost class and is the place to copy from.

Read the receipt. Contrast diagnostics are warnings, not errors, because the
palette is host-owned: a two-token White on Blue registers successfully and
returns contrast warnings, and a host that filters on `severity === "error"`
ships cyan links on a mid-blue page. `registerPieColorSchemes` checks only the
relationships whose tokens the overlay touches, so covering a flagged token is
what clears its relationship.

These eleven stay host palettes. A built-in sets every token whose scheme
participation is `required`, since a two-color scheme is a promise the whole
surface has to keep, and which schemes a program wants is still open.

## Fixed hues

Some components paint a hue the palette does not own: a data encoding, like the
periodic table's category fills. `--pie-fixed-hue-collapse` is the share by
which such a hue folds into the palette — the component mixes its own value
toward `--pie-background-dark` and `--pie-text` by this share, so `0%` renders
the authored hue exactly and `100%` removes it.

Base Themes set `0%`, because a full palette leaves a hue encoding readable.
Every color scheme sets `100%`: a two-color palette is a promise, and a hue
that survives it is a color the learner did not choose. A registered custom
scheme collapses without declaring anything, and keeps its encodings by setting
`--pie-fixed-hue-collapse: 0%` itself.

Both ends of the mix are exact, so this costs nothing under a Base Theme. What
it costs under a scheme is the encoding: a component collapsing hues has to
carry category, state or series somewhere else — a label, a filter, or the
accessible name.

## Font size scaling

`font-sizes.css` carries four presets on `--pie-font-scale` — `normal` (1),
`large` (1.25), `xlarge` (1.5), `xxlarge` (1.75). They are Learnosity's steps,
which K-12 accommodation profiles are already written against, so the numbers are
a contract: changing one changes what `large` means for every learner assigned it.

A host selects a preset with `data-font-size` on any ancestor of the player, or
on a player element itself:

```html
<html data-font-size="large">
<div data-font-size="xlarge"><pie-section-player-splitpane></pie-section-player-splitpane></div>
```

A host already driving `<pie-theme>` sets the token instead and needs nothing
from the stylesheet:

```html
<pie-theme variables='{"--pie-font-scale":"1.25"}'>
```

The content path scales completely:

- The rules set `font-size` on the content hosts — `pie-item-scope`,
  `pie-passage-shell`, `pie-item-player` and the externally loaded `pie-player`
  wrapper — and `font-size` inheritance crosses shadow boundaries, so text that
  inherits its size follows.
- Every font size in `components.css`, which styles item content, is relative
  (`em`, `%`, `larger`/`smaller`) and follows too.
- Learner-facing text that declares its own size reads `--pie-font-scale`
  directly: the item and passage card titles, the formative status line, the
  tabbed layout's labels and the item player's build warning. A card wraps the
  shell that gets scaled, so it cannot inherit the scale.

Tool and debug chrome does not scale: an accommodation applies to what the
learner reads, and a calculator keypad growing with the passage is a layout
problem.

A rule elsewhere that sizes text in `rem` or `px` does not follow — `rem`
resolves against the document root and `px` against nothing, and no rule inside a
subtree can change what either means — so a host adding its own content chrome
either sizes it relatively or reads the token as these rules do. Browser zoom is
unaffected throughout, so WCAG 2.2 1.4.4 does not depend on this feature.

The scale is applied as `calc(1rem * var(--pie-font-scale))` because the content
hosts nest: an `em` factor would compound, turning a requested 1.25 into 1.56
wherever an item shell sits inside a themed region.

The package ships no student-facing control. The picker is host chrome; this
package owns the token, the presets, and the rules that consume them.

## Token registry

`@pie-players/pie-theme/token-registry.json` lists each registered `--pie-*`
token with its owner, scope, category, status, fallback policy, and scheme
participation (`required`, `optional`, or `excluded`).
`PieThemeTokenRegistryEntry` types it.

A token is registered when a host sets it, or when package documentation tells a
host to set it. The registry also records a few `package-private` entries whose
fallback chain or presence sentinel needs a record, such as
`--pie-content-styles`; a `package-private` entry is not a host hook. Every
other `--pie-*` name in PIE source is internal to its package.

Registered names and values are stable:

- A registered name is not renamed or dropped. Reclassifying an entry from
  `component-public` to `package-private` withdraws a promise a host may hold,
  so it is held to the same bar as a rename.
- A rendered value changes only to repair a diagnosed accessibility failure or a
  host-visible defect, and the changeset names the change and the relationship it
  repairs.

The registry is published so a host can show a person what a token is for and
who owns it. Read the registry rather than deriving grouping from token names or
keeping a local copy: both drift as soon as a token is added here, and
`check:theme-tokens` holds the registry against source on every commit.

## Light DOM and Shadow DOM

`--pie-*` tokens are the runtime contract for every PIE custom element, and they
inherit across shadow boundaries through the host. Light-DOM components read
them from the document or the scoped host as normal. For component authors:

- In a shadow-DOM component, style internals from `--pie-*` tokens, and expose
  host customization through documented `::part(...)` names or attributes only
  where needed. Global selectors do not reach shadow internals.
- In a light-DOM component, depend on no host utility classes, and read the same
  `--pie-*` tokens, so a move to `shadow: "open"` stays incremental.
- Style focus, active and hover states from the interaction tokens
  (`--pie-focus-*`, `--pie-button-*`), not from hardcoded color literals.
- A theme switch, or a scheme or provider registration, updates existing nodes,
  light and shadow, without a remount.
- Cover forced-colors behavior without `forced-color-adjust: none`; system color
  replacement is an accessibility feature.

## Style Ownership

Use `@pie-players/pie-theme/components.css` for shared visual styles that are intentionally reused across multiple PIE custom elements.

`@pie-players/pie-item-player` installs this stylesheet itself, so a host needs
no second copy. A host may still load the exported stylesheet itself, and that
published path is supported. Mounting `<pie-theme>` does not load it — the
element only writes `--pie-*` custom properties. The item player bundles the
stylesheet as text and installs it once per document at import time, unless the
host already loads a copy; see
[content styles](../item-player/README.md#content-styles) for host ownership.
Its rules apply inside a `[data-pie-content]` element only, the root each player
renders content into, except rules keyed on `kds-*` or MathJax (`mjx-*`) class
names or legacy content classes, which stay document-wide so authored markup an element portals
to `<body>` keeps them.

Players adding this import the text with `?raw` and hand it to
`installContentStyles` from `@pie-players/pie-players-shared`. In these packages'
library builds a plain `import "…/components.css"` is extracted by Vite to an
unreferenced `dist/assets/*.css` that nothing loads.

`components.css` declares `--pie-content-styles` on `:root` as a presence
sentinel so players can recognize a copy the host loaded itself, scoped or not,
and install none of their own. It is not a themeable value; do not consume it for
styling.

- Theme-owned shared `pie-*` class families include `pie-answer-eliminator-*`
  and `pie-answer-masked-*`.
- Keep runtime behavior, DOM mutation logic, and element-specific layout mechanics in the owning package.
- Prefer stable `pie-*` / `data-pie-*` hooks in component markup; avoid introducing new generic class contracts.

## Generated CSS

`tokens.css` and `color-schemes.css` are checked-in output adapters. Generation
is explicit so builds and releases never rewrite tracked source:

```sh
bun --cwd packages/theme run generate:css
bun --cwd packages/theme run check:generated-css
```

The writer is `packages/theme/scripts/generate-theme-css.ts --write`; `--check`
performs the non-mutating comparison. `bun run check:theme-tokens` also rejects
stale generated CSS, and the theme package build runs the stale check before it
copies the existing files to `dist`.

The package-internal `renderPieThemeCss()` implementation lives in
`src/theme-css.ts`; it is not a public export. Generated `color-schemes.css`
contains one unlayered `[data-color-scheme="..."]` rule per built-in scheme and
no base-theme or grouped exception rules.
