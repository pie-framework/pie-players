---
"@pie-players/pie-theme": patch
---

Adds `--pie-focus-keyboard-outline`, the keyboard focus ring for a control drawn on its own fill rather than the page, defined by both Base Themes and every scheme. It repairs the ring on the PIE elements' keypad keys (WCAG 1.4.11), where `--pie-button-focus-outline` fell under 3:1 against the key fill in two palettes: the light Base Theme sets `#0952c8` (3.93:1, against `#3b82f6` at 2.10:1) and `light-gray-on-dark-gray` sets `#ffffff` (6.50:1, against `#aaaaaa` at 2.80:1). Every other palette takes its button focus outline. No existing token or rendered value changes. A provider, registered custom scheme or `variables` that set `--pie-button-focus-outline` alone give the new ring the same value, so existing palettes keep their focus colour.
