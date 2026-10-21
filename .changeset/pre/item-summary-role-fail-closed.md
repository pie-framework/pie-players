---
"@pie-players/pie-item-list": patch
---

`<pie-item-summary>` withholds answers for any `env.role` other than `instructor`, as `summarizeItem` and `<pie-item-player>` do; no `env` stays the instructor view. Summaries with repeated element or option ids render instead of failing, and a summary that fails to render no longer leaves the previous item's summary showing.
