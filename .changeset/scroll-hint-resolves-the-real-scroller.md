---
"@pie-players/pie-section-player": patch
---

Resolve the items-pane scroll hint's container as the nearest scrolling ancestor, so the vertical layout gets a working hint instead of a permanent one.

PIE-549 took the pane element's parent as the scroll container. That is the scrolling box in the split-pane and tabbed layouts. In the vertical layout it is `<section class="pie-section-player-items-section">`, which is `overflow: visible`; the scroller is one level up, `.pie-section-player-vertical-content`. Measured on `/three-questions?mode=candidate&layout=vertical` at 1280x500, that section reported `scrollHeight` 1290 against `clientHeight` 1274 — the 16px is the sticky hint's own box overflowing the section, so the hint was what made its own measurement true. `isScrollable` was therefore permanently true, `atBottom` unreachable on an element whose `scrollTop` stays 0, and the control's `scrollBy` a no-op: a "Scroll down" button always on screen and always inert. Against the correct container the same content reports `scrollHeight` equal to `clientHeight` when it fits.

PIE-549 specs the hint conditionally — "if there is content below the fold" — and exists to stop a learner clicking "Next >" with questions unseen, which an always-on indicator undercuts. PIE-717 is the other cost: a permanently present overlay is what made answer choices under the 56px gradient unclickable, and the mitigation recorded there rests on the hint disappearing at the end of the scroll.

`auto`, `scroll` and `overlay` count as scrolling; `hidden` does not, because its scrollport is unreachable and hinting at content below the fold of a region nobody can scroll is the same defect from the other end. The walk is bounded at `<body>`: every layout in this package supplies its own scrolling pane, and falling through to the host document's scroller would hint at a region the pane does not own. Where no scrolling ancestor exists the hint stays hidden.

The container is bound on the first deferred pass rather than in `onMount`, because computed style is what identifies it and there is none yet at mount: `getComputedStyle` returns an empty declaration for every element between the pane and `pie-section-player-base`, so `overflowY` reads `""`. One task later it resolves, and any later pass retries until it does. The `MutationObserver` moved from the container to the pane element, which needs no computed style to identify and carries the item cards as its children; in the split-pane and tabbed layouts the container's only child is that element, so it is the same record stream.

Only the reference app exercises the vertical layout, so no external host sees this change; the consumer pad records no host touching scroll behaviour at all.
