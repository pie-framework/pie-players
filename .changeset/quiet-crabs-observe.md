---
"@pie-players/pie-players-shared": patch
---

Coalesce `PieItemPlayer`'s post-render overwide-wrap pass and stop it retriggering itself.

The pass exists so images and tables a PIE element paints into its own light DOM
get the same `pie-image-scroll` / `pie-table-scroll` reflow affordance as authored
markup (PIE-94, WCAG 1.4.10). It observed the item subtree with
`{ childList: true, subtree: true }` and re-ran `wrapOverwideImagesInElement` +
`wrapOverwideTablesInElement` on every mutation tick, each a `querySelectorAll`
over the whole subtree. A PIE element that re-renders per keystroke or selection
change therefore bought a full re-scan per mutation batch, with no coalescing.

The wrap also inserts elements, so it queued records that re-fired the observer
that scheduled it. That converged only because the wrap is idempotent — one
wasted full scan per productive pass — and an element that re-renders over its
own subtree and drops the inserted wrapper would have turned it into a sustained
wrap → mutation → wrap loop.

Batches now coalesce into a single deferred pass, and the observer ignores a batch
that is entirely the wrap's own output, so the self-retrigger is gone rather than
absorbed. Measured in Chromium: late element-painted content settles at two
passes where it previously took three. A timer rather than
`requestAnimationFrame` schedules the pass, because a document with no compositor
never runs a frame callback — the PIE-885 failure mode — and a wrap that never
lands is a reflow regression in exactly the headless and CI contexts the e2e
suites run in.

What gets wrapped and the markup produced are unchanged: the live-DOM pass still
emits byte-identical wrappers to the string pipeline in `sanitizeItemMarkup`, and
the print player's `wrapOverwideContent: false` opt-out is untouched.

New exports: `isOverwideImageWrapMutation` and `isOverwideTableWrapMutation`,
which report whether a `MutationRecord` mentions nothing but the corresponding
wrapper's own live-DOM output. Any host running its own observer-driven wrap pass
needs the same test.
