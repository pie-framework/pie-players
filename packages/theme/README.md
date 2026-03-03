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
- `provider`: provider id or `auto` (default)
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

## Light DOM and Shadow DOM

- `--pie-*` variables are the stable runtime contract for all components.
- Light DOM components read variables from document or scoped host as normal.
- Shadow DOM components should consume `--pie-*` internally; variables inherit across shadow boundaries through the host.
- Avoid relying on global selectors for shadow internals; prefer variable-driven styling.

## Style Ownership

Use `@pie-players/pie-theme/components.css` for shared visual styles that are intentionally reused across multiple PIE custom elements.

- Theme-owned shared `pie-*` class families include:
  - `pie-section-player-tools-pnp-debugger*`
  - `pie-section-player-tools-session-debugger*`
  - `pie-answer-eliminator-*` and `pie-answer-masked-*`
- Keep runtime behavior, DOM mutation logic, and element-specific layout mechanics in the owning package.
- Prefer stable `pie-*` / `data-pie-*` hooks in component markup; avoid introducing new generic class contracts.
