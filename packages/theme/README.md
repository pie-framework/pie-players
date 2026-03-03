# @pie-players/pie-theme

Shared PIE theming primitives and the `pie-theme` custom element.

`pie-theme` now auto-detects DaisyUI color tokens (for example `--color-base-100`, `--color-primary`) and translates them to PIE `--pie-*` variables before applying explicit `variables` overrides.

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
- `variables`: JSON object of CSS variable overrides

## DaisyUI Integration

- If DaisyUI tokens are present on the target scope, `pie-theme` uses them to derive PIE theme variables.
- Override precedence is: base PIE theme -> DaisyUI-derived variables -> `variables` attribute overrides.

## Style Ownership

Use `@pie-players/pie-theme/components.css` for shared visual styles that are intentionally reused across multiple PIE custom elements.

- Theme-owned shared `pie-*` class families include:
  - `pie-section-player-tools-pnp-debugger*`
  - `pie-section-player-tools-session-debugger*`
  - `pie-answer-eliminator-*` and `pie-answer-masked-*`
- Keep runtime behavior, DOM mutation logic, and element-specific layout mechanics in the owning package.
- Prefer stable `pie-*` / `data-pie-*` hooks in component markup; avoid introducing new generic class contracts.
