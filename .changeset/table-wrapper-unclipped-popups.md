---
"@pie-players/pie-theme": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
---

A `.pie-table-scroll` wrapper with nothing to scroll no longer clips what a PIE element opens inside the table. Previously the keypad of a math-inline or math-templated answer field in a table was cut off at the table's bottom edge; in a table that fits its column it now opens in full. The theme makes the wrapper a scroll container only while it is a region. The live item player keeps it a region only while the table is wider than its column. Markup sanitized outside the player keeps the region, and the scroll, on every wrapper. The wrapper is `display: flow-root` instead of `block`, so the table lays out the same either way.

To decide whether a wrapper scrolls, the player now measures the wrapped table or image by its own width and inline-start margin, not by the wrapper's scroll width. An open keypad that reaches past the column therefore no longer reads as overflow and turns the wrapper back into a scroll container. Transformed content is still measured by the scroll width, which counts the transform. An image wrapper still scrolls as before. It no longer becomes a tab stop when the only thing past the edge is the image's empty end margin, or an overflow of 1px. A keypad in a table that does scroll is still clipped by it: escaping a scroll container is the element's to do, by positioning its popup `fixed`.
