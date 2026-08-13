# @pie-players/pie-theme

Shared PIE theming primitives and the `pie-theme` custom element.

`pie-theme` resolves canonical PIE variables (`--pie-*`) with this precedence:

1. Base PIE theme (`theme=light|dark|auto`)
2. Provider adapter output (for example DaisyUI tokens)
3. Selected color scheme (`scheme`)
4. Explicit `variables` overrides

## Usage

```ts
import "@pie-players/pie-theme";
import "@pie-players/pie-theme/tokens.css";
import "@pie-players/pie-theme/color-schemes.css";
import "@pie-players/pie-theme/font-sizes.css";
```

```html
<pie-theme theme="auto" scope="document">
  <pie-section-player></pie-section-player>
</pie-theme>
```

## Custom element API

- `theme`: `light | dark | auto`
- `scope`: `self | document`
- `provider`: provider id, `auto` (default), or `none`
- `scheme`: color scheme id (`default` by default)
- `variables`: JSON object of CSS variable overrides

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

## Custom Color Schemes

Register consumer-defined schemes without modifying framework source:

```ts
import { registerPieColorSchemes } from "@pie-players/pie-theme";

registerPieColorSchemes([
  {
    id: "district-high-contrast",
    name: "District High Contrast",
    description: "District accessibility palette",
    variables: {
      "--pie-background": "#000000",
      "--pie-text": "#ffffff",
      "--pie-primary": "#00ffff",
    },
    preview: {
      bg: "#000000",
      text: "#ffffff",
      primary: "#00ffff",
    },
  },
]);
```

Then activate with `scheme="district-high-contrast"` on `pie-theme`.

## DaisyUI Integration

- If DaisyUI tokens are present on the target scope, `pie-theme` uses the built-in `daisyui` provider adapter.
- Override precedence is: base PIE -> provider output -> scheme -> `variables`.
- `provider="none"` (`PIE_THEME_PROVIDER_NONE`) resolves no provider at all, leaving this package's shipped defaults. It is how a host reproduces the palette it had before adopting a provider, which is the first thing to check when colours differ between two environments.

## Token registry

`@pie-players/pie-theme/token-registry.json` lists every `--pie-*` token with its owner, scope, category, status and fallback policy. `PieThemeTokenRegistryEntry` types it.

It is published so a host can show a person what a token is for and who owns it. Read the registry rather than deriving grouping from token names or keeping a local copy: both drift as soon as a token is added here, and `check:theme-tokens` holds the registry against source on every commit.

## Light DOM and Shadow DOM

- `--pie-*` variables are the stable runtime contract for all components.
- Light DOM components read variables from document or scoped host as normal.
- Shadow DOM components should consume `--pie-*` internally; variables inherit across shadow boundaries through the host.
- Avoid relying on global selectors for shadow internals; prefer variable-driven styling.

## Style Ownership

Use `@pie-players/pie-theme/components.css` for shared visual styles that are intentionally reused across multiple PIE custom elements.

**Players install this stylesheet themselves; hosts do not import it.** Mounting
`<pie-theme>` does not load it either — that element only writes `--pie-*` custom
properties. `@pie-players/pie-item-player` bundles the stylesheet as text and
installs it once per document at import time; see
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
