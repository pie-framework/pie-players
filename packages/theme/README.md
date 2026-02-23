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
