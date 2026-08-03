---
"@pie-players/pie-print-player": patch
"@pie-players/pie-players-shared": patch
---

Preserve authored attributes and children through the print tag swap, and sanitize print markup by default.

`processMarkup` previously carried only `id`, `pie-id`, and `data-original-tag` onto the freshly built print element, so everything else authored on that element was silently dropped:

- `class`, `style`, `lang`, `dir`, `aria-*`, and `data-*` were lost. An item authored as `<multiple-choice id="1" class="noprint">` lost its print-suppression hook and printed anyway on hosts that load `@pie-players/pie-theme/components.css`.
- Child nodes were lost, discarding authored fallback content and destroying nested interactive elements — a nested element could even be reported in the returned node list while being absent from the returned markup.

All attributes are now copied and children are moved across. `id`, `pie-id`, and `data-original-tag` are still set by the processor so they win over any authored value of the same name.

`<pie-print>` now also sanitizes authored `item.markup` through `@pie-players/pie-players-shared/security` by default, matching `<pie-item-player>`. Hosts can opt out with the `trust-markup` attribute or supply their own sanitizer via the `sanitizeMarkup` property. The interactive element tags from `item.elements` and their hashed print variants are allow-listed so sanitizing does not strip them.

`sanitizeItemMarkup` gains a `wrapOverwideContent` option (default `true`, unchanged for the screen players). The print player passes `false`: the overwide image/table wrappers are `overflow-x: auto` reflow affordances with no `@media print` override, and `overflow` clips rather than scrolls in print media, so wide images and tables would be cut off.

Also drops the `static styles` block from `PiePrint`. It declared a `:host` border, padding and `max-width`, none of which ever applied: `createRenderRoot()` returns `this` for light-DOM rendering, so Lit never calls `adoptStyles`. Removing dead declarations, no rendered change.
