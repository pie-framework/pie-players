---
"@pie-players/pie-theme": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-section-player": patch
---

`components.css` no longer styles layout tables: a `.table` marked `.table-no-border` or `role="presentation"` gets no grid, full width or cell padding, so migrated items Host P renders lay out as they did under the legacy player, without a rule above the first row or tiles pushed apart. Bordered data tables keep the grid.
