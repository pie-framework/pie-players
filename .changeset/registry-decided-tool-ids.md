---
"@pie-players/pie-assessment-toolkit": patch
---

`ToolRegistry.filterDecidedToolIds(entries, level, contexts)` runs the toolbar's relevance and applicability passes over a policy decision's tools, sparing a granted entry from relevance, so a host-built toolbar applies the same rule as `<pie-item-toolbar>`, which now calls it. Toolbar buttons follow decision order; a granted or host-resolved tool used to render ahead of the others.
