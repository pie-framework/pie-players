# @pie-players/pie-theme

Shared PIE theming primitives and the `pie-theme` custom element.

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
