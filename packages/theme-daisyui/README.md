# @pie-players/pie-theme-daisyui

Bridge DaisyUI theme tokens to PIE `--pie-*` variables.

When using `@pie-players/pie-theme`, Daisy token translation is applied automatically by the `pie-theme` element.

## Usage

```ts
import "@pie-players/pie-theme-daisyui/bridge.css";
```

Or apply variables with JavaScript:

```ts
import { applyDaisyThemeToElement } from "@pie-players/pie-theme-daisyui";
```

You can also read resolved Daisy tokens from an element and map them:

```ts
import {
	readDaisyThemeTokensFromElement,
	mapResolvedDaisyThemeToPieVariables
} from "@pie-players/pie-theme-daisyui";
```
