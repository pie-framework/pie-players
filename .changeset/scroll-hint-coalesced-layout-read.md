---
"@pie-players/pie-section-player": patch
---

Coalesce the items-pane scroll-hint's layout read into one deferred pass, and read each box metric once.

`updateScrollable` in `SectionItemsPane` ran on every notification from a `ResizeObserver`, a `MutationObserver` over the whole items subtree (`childList`, `subtree`, `characterData`) and a passive `scroll` listener, and each run read `scrollHeight` twice plus `scrollTop` and `clientHeight`. Every one of those reads flushes layout for the container that holds every item card and every live PIE element in the section. Typing 105 characters into a hosted rich-text element produced 105 mutation batches and 214 container `scrollHeight` reads; after the change the same input produces 106.

Measured on a two-card pane (360 elements), one such read costs 0.1 ms median and 0.3 ms at the maximum, and it scales with pane size. The three sources now share one pending read, the pass already scheduled is kept rather than re-armed so an unbroken mutation stream cannot push it back indefinitely, and teardown cancels a pending pass so no read lands on a detached container.

A zero-delay timer schedules the read rather than `requestAnimationFrame`, matching the post-render overwide-wrap pass in `players-shared`'s `PieItemPlayer`. A document with no compositor never runs a frame callback, which is the PIE-885 failure recorded in `assessment-toolkit/src/runtime/composition-emit-scheduler.ts`. On a frame-based read the hint stayed permanently hidden in that document — the cards mount after `onMount`, so every update that arms the hint arrives through the observer — which is the below-the-fold discoverability regression PIE-549 exists to prevent, in exactly the headless and CI contexts the e2e suites run in.

The observer keeps `characterData` and `subtree`, both load-bearing. A separate 200-character run produced 200 mutation batches, 199 of them carrying characterData records and no childList record, against exactly one change in the container's `scrollHeight` — soft-wrapping a line inside an existing text node grows the content and emits no childList record, so dropping `characterData` would leave the hint stale while a learner types past the fold. `subtree` is required because the container's only child is the pane custom element and the item cards are its grandchildren.

Behaviour is unchanged: the hint still appears when content sits below the fold, hides at the bottom, re-arms when content grows, and scrolls the pane on click. The gradient, the zoom cap at 200%, the gradient drop past 300% and the pointer-events split from PIE-625, PIE-717, PIE-730 and PIE-731 are untouched. `packages/section-player/tests/section-player-scroll-hint.spec.ts` covers those four behaviours plus the non-painting document, and polls, because the read is deliberately deferred.
