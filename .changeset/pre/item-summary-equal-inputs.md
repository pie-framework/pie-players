---
"@pie-players/pie-item-list": patch
---

`<pie-item-summary>` keeps its summary and its loaded player when a host sets an equal `config`, `summary`, `env`, `loaderOptions` or `loaderConfig` object again, comparing plain objects and arrays by content and anything else by identity.
