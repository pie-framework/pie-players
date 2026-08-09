---
"@pie-players/pie-section-player": patch
---

`<pie-item-shell>` and `<pie-passage-shell>` now dispatch `pie-register` only when the registration's own values change, and `pie-unregister` only on teardown.

Both shells dispatched registration from the effect that attached their listeners, with `pie-unregister` in that effect's cleanup — so every re-run announced a teardown and a rebuild of state that had not moved. The runtime takes those announcements literally: a `pie-register` unregisters and re-registers the content's accessibility catalogs, re-runs `sectionEngine.register`, and re-notifies the section controller. Between the unregister and the register, content the learner is looking at has no catalogs at all.

It was also the far half of a cycle. Any reader that re-renders in response to a catalog change re-applies a shell's props, which re-registers, which changes catalogs again. That shipped once and was measured at roughly a thousand rounds per item, ending in Svelte abandoning the update at its depth limit with the DOM half-applied — and every assertion about the rendered output passed while it was happening, because the elements were present; only the classes and grid columns the aborted update never reached were wrong. The reader was fixed on its own side; this is the half that stops the next one from re-opening the circuit.

Listener attachment now depends on `host` alone, which in the item shell is also what makes the session dedupe state outlive a prop change instead of being rebuilt — and forgetting what it had already forwarded — on each one. The dispatch decision moved to `createShellRegistrationDispatcher` in `components/shared/shell-registration.ts`, shared by both shells: it compares `kind`, `host`, `itemId`, `canonicalItemId`, `contentKind` and `item` against what was last dispatched, `item` by identity, because the churn being guarded against re-applies the same object while a genuinely new item object means content whose catalogs may differ. No unregister precedes that re-register: both registration paths in the toolkit are keyed by element and replace what is there, so the unregister only ever created the gap.

Teardown replays the identity it registered under rather than reading the current props, since by then the props may already describe the replacement.

`packages/section-player/tests/section-player-item-shell-registration.spec.ts` counts the events per content id and kind on demo pages: one register per mounted shell, zero unregisters while mounted, and replaced content that re-registers without an unregister in between.
