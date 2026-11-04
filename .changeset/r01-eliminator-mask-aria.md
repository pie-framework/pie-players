---
"@pie-players/pie-tool-answer-eliminator": patch
---

The `mask` elimination strategy now announces the eliminated state to assistive technology the way `strikethrough` does (R-01): the choice is marked `aria-disabled` and carries an offscreen, interface-locale "(eliminated)" announcement that is relabelled on locale change, instead of `aria-hidden` on the choice container. The container hosts the strategy's toggle, so `aria-hidden` there hid the undo control from screen-reader and keyboard users along with the masked answer (WCAG 4.1.2). The README's ARIA-hooks description now matches both strategies.
