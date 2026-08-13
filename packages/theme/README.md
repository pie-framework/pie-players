# @pie-players/pie-theme

Shared PIE theming primitives and the `pie-theme` custom element.

`pie-theme` resolves PIE theme tokens (`--pie-*`) with this precedence:

1. Base PIE theme (`theme=light|dark|auto`)
2. Provider adapter output (for example DaisyUI tokens)
3. Resolved registered color scheme (`scheme`)
4. Explicit `variables` overrides

Base themes and built-in color schemes are authored once in TypeScript. The
runtime resolver and the checked-in CSS adapters use those same definitions, so
the managed custom-element path and the stylesheet-only path cannot carry
different palettes.

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

Keep that distinction when integrating or bundling the package. Existing hosts
depend on the root entrypoint registering the element and on `theme-element`
waiting for an explicit call.

The four stylesheet artifacts remain available at both their package export and
literal `dist` paths:

- `tokens.css`
- `color-schemes.css`
- `font-sizes.css`
- `components.css`

They are unlayered deliberately. In stylesheet-only delivery, a host may
continue to override public tokens through normal source order, specificity, or
`!important`.
The element-name portion of the base-theme adapter uses `:where(...)`, keeping
its specificity below a later `[data-color-scheme]` rule. In a stylesheet-only
integration, that lets a host scheme override the generated base theme through
the normal cascade without `!important`.

```html
<pie-theme theme="auto" scope="document">
  <pie-section-player></pie-section-player>
</pie-theme>
```

## Custom element interface

- `theme`: `light | dark | auto`
- `scope`: `self | document`
- `provider`: provider id, `auto` (default), or `none`
- `scheme`: requested color-scheme id (`default` by default)
- `variables`: JSON object of CSS custom-property overrides

`default` means no named color scheme; the base theme and provider still apply.
For any other value, requested and resolved scheme are separate states. If the
id is unavailable, `<pie-theme>` keeps it in both `scheme` and
`data-color-scheme`, renders the safe base/provider result plus any explicit
`variables`, and automatically uses it if a matching custom scheme is registered
later. Retaining `data-color-scheme` preserves a selector hook, but does not give
an unregistered scheme managed precedence. A mounted `<pie-theme>` writes its
resolved tokens inline, so a competing host selector must use `!important`; use
a Registered Custom Scheme when the scheme needs normal managed precedence. A
stylesheet-only integration without a mounted `<pie-theme>` continues to use
the normal cascade.

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
contains `baseTheme`, `requestedScheme`, `resolvedScheme`, `status` (`default`,
`built-in`, `custom`, or `unavailable`), final `variables`, and `diagnostics`.

`resolvePieTheme()` returns the requested id, resolution status, resolved
descriptor when available, final immutable token values, and diagnostics.
`listPieColorSchemes()` returns an immutable snapshot whose `schemes` list keeps
the built-in order and starts with the `default` descriptor. Catalog previews
resolve each scheme over PIE's canonical light base, then project
`--pie-background`, `--pie-text`, and `--pie-primary`; they are not separately
authored swatches or a promise to mirror a host-specific provider. Projection
preserves a deterministic opaque subset: named colors, three- or six-digit hex,
non-alpha `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`,
and standard CSS Color 4 `color()` spaces. Transparent, explicit-alpha,
relative, nested, context-dependent, malformed, or unsupported forms fall back
to the canonical opaque preview swatch, so a preview never inherits accidental
colors from the picker itself. The authored theme variable is not changed by
that fallback.

`observePieColorSchemes()` calls the listener immediately with the current
snapshot, then once after each successful catalog-changing registration or
unregistration. Listener failures are isolated, and reentrant mutations produce
later coherent snapshots rather than interrupting the current notification.

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
unknown tokens, and excluded/private/legacy tokens cannot be registered. The
latest valid registration for a custom id wins, and an older receipt cannot
remove that newer definition. Validation returns structured diagnostics and
warns concisely by default; it does not throw for ordinary invalid input.
Contrast diagnostics inspect affected semantic relationships in the fully
resolved custom palette and remain non-blocking because that palette is
host-owned.

Use the final `variables` property for deliberate per-instance overrides. Use a
CSS selector keyed by `data-color-scheme` only when a CSS-only scheme and its
cascade requirements are intentional. Such a selector follows the normal
cascade in a stylesheet-only integration; when it competes with a mounted
`<pie-theme>`'s inline tokens, it needs `!important`.

## DaisyUI Integration

- If DaisyUI tokens are present on the target scope, `pie-theme` uses the built-in `daisyui` provider adapter.
- Override precedence is: base PIE -> provider output -> scheme -> `variables`.
- `provider="none"` (`PIE_THEME_PROVIDER_NONE`) resolves no provider at all, leaving this package's shipped defaults. It is how a host reproduces the palette it had before adopting a provider, which is the first thing to check when colours differ between two environments.

## Token registry

`@pie-players/pie-theme/token-registry.json` lists every `--pie-*` token with its
owner, scope, category, status, fallback policy, and scheme participation
(`required`, `optional`, or `excluded`). `PieThemeTokenRegistryEntry` types it.

It is published so a host can show a person what a token is for and who owns it. Read the registry rather than deriving grouping from token names or keeping a local copy: both drift as soon as a token is added here, and `check:theme-tokens` holds the registry against source on every commit.

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

## Light DOM and Shadow DOM

- `--pie-*` variables are the stable runtime contract for all components.
- Light DOM components read variables from document or scoped host as normal.
- Shadow DOM components should consume `--pie-*` internally; variables inherit across shadow boundaries through the host.
- Avoid relying on global selectors for shadow internals; prefer variable-driven styling.

## Style Ownership

Use `@pie-players/pie-theme/components.css` for shared visual styles that are intentionally reused across multiple PIE custom elements.

`@pie-players/pie-item-player` installs this stylesheet itself, so new hosts do
not need a second copy. Existing hosts may still own the exported stylesheet;
that published path remains supported. Mounting `<pie-theme>` does not load it —
the element only writes `--pie-*` custom properties. The item player bundles the
stylesheet as text and installs it once per document at import time; see
[content styles](../item-player/README.md#content-styles) for the host-ownership
opt-out.

Note for players adding this: a plain `import "…/components.css"` does **not**
work in these packages' library builds. Vite extracts it to an unreferenced
`dist/assets/*.css` that nothing loads and no exports entry exposes — a silent
no-op that left authored passage markup unstyled in production. Import the text
with `?raw` and hand it to `installContentStyles` from
`@pie-players/pie-players-shared`.

`components.css` declares `--pie-content-styles` on `:root` as a presence
sentinel so players can tell whether an opted-out host actually loaded it. It is
not a themeable value; do not consume it for styling.

- Theme-owned shared `pie-*` class families include:
  - `pie-section-player-tools-pnp-debugger*`
  - `pie-section-player-tools-session-debugger*`
  - `pie-answer-eliminator-*` and `pie-answer-masked-*`
- Keep runtime behavior, DOM mutation logic, and element-specific layout mechanics in the owning package.
- Prefer stable `pie-*` / `data-pie-*` hooks in component markup; avoid introducing new generic class contracts.
