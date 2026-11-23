---
"@pie-players/pie-theme": patch
---

Under forced colors, `<pie-theme>` and the generated `tokens.css` map the focus-outline, border and disabled tokens to `Highlight`, `CanvasText` and `GrayText` (PIE-1565), so every host draws focus and selection in `Highlight` and disabled controls in `GrayText`; outside forced colors no token changes. Host A's `!important` border overrides keep its own values, and Host R's contrast inspector reads system-color keywords for the mapped tokens.
