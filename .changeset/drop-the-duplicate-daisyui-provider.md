---
"@pie-players/pie-theme-daisyui": patch
---

Remove `daisyThemeProviderAdapter` and `registerDaisyThemeProvider`.

`@pie-players/pie-theme` registers a provider adapter under the id `daisyui` at
import time, and this package exported a second one under the same id. Now that
both resolve the same `DAISYUI_PIE_TOKEN_MAP`, they are the same adapter, so
`registerDaisyThemeProvider()` could only overwrite the built-in with a clone of
itself — and because `unregisterPieThemeProvider` refuses to drop `daisyui`, there
was no way back either.

Nothing was calling them. Hosts using `<pie-theme>` already get the built-in
adapter; hosts writing variables themselves keep `applyDaisyThemeToElement`,
`readDaisyThemeTokensFromElement` and the two mappers, which differ from the
adapter in input shape rather than duplicating it.
