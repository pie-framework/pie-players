---
"@pie-players/pie-assessment-toolkit": patch
---

Deliver the section composition without waiting for the document to paint, so a
section renders in a context that has no compositor.

`PieAssessmentToolkit` publishes the composition to the players through exactly
one path, the `composition-changed` event, and coalesces bursts of updates behind
a one-shot emit latch. That latch was cleared only by a `requestAnimationFrame`
callback, and the frame branch was taken whenever `window.requestAnimationFrame`
merely *existed* rather than when it was known to fire. Where no frame ever
arrives the latch never cleared, no `composition-changed` was dispatched, and the
layout kernel kept its initial empty composition — `section: null`, empty `items`
and `renderables`. The `queueMicrotask` fallback could not rescue it, because it
was only reached when rAF was absent entirely.

The distinguishing symptom was a split between the two halves: the section
controller held a correct view model with the right item ids while the player's
`compositionModel` was the empty default. The content was computed and simply
never delivered, so it did not read as a content, catalog, or bundle problem.

Frame scheduling now lives in an internal `composition-emit-scheduler`, which
races the frame against a 100ms deadline timer. Whichever arrives first releases
the latch and flushes. On a painting document the frame still wins with six
frames of margin at 60fps, so emits stay paint-aligned and coalescing is
unchanged — several composition updates within one frame still produce a single
`composition-changed`. Where frames never arrive the timer takes over and the
document degrades to a slower render instead of a permanent blank. Svelte's own
`tick()` races the same two primitives for the same reason.

The scheduler owns the latch and both handles, so releasing the latch and
releasing the handles is one operation in one place — a cancelled or superseded
frame can no longer strand the latch. The toolkit's dispose path cancels through
it rather than clearing two variables by hand.

Impact was confined to verification and automation, with no known learner-facing
scoring or data effect. A background tab recovered on refocus, because its
pending frame becomes due then, so learner delivery saw at most a delayed first
render. The permanent failure was in contexts that never paint — headless
browsers without a compositor, hidden or offscreen tabs, and agent or CI
automation harnesses — where every `pie-section-player` route rendered no content
and read as whatever feature was under test being broken.
