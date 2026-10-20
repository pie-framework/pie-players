---
"@pie-players/pie-item-list": patch
---

`<pie-item-summary>` now checks a precomputed `summary` field by field and recomputes a malformed one from `config`. The same check is exported from `./summarize` as `isItemSummary`. Options that carry a `group` render nested under the group's label. A new `env` object with an unchanged `role` no longer re-renders the row or fires another `load-complete`.
