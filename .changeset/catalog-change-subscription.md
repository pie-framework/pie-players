---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

`onCatalogsChange` on the catalog resolver and the toolkit coordinator, replacing a timed retry in the item card's signing region.

A reader that *renders* a catalog card has to answer "is there content for this item" before the catalogs exist: registration is driven by an item shell's mount event, which lands after a card rendered alongside that item has already computed its first answer. TTS never hit this because it resolves by DOM lookup at the moment it speaks. The signing region did, and it compensated with a bounded retry — 20 attempts, 50 ms apart — after which it stopped for good. No budget is right for that: a second is too short when element bundles load slowly, and running out of it left an eligible learner with no signing video and nothing logged. An accommodation that fails this way is invisible to everyone except the person who needed it.

`AccessibilityCatalogResolver.onCatalogsChange(listener)` now reports registrations and removals, with `ToolkitCoordinator.onCatalogsChange` delegating to it exactly as `onPolicyChange` delegates to the policy engine. The event names what changed (`scoped-registered`, `scoped-removed`, `item-added`, `item-cleared`) and carries the owner context for the scoped reasons, but no resolved cards: listeners re-query with their own lookup context, which keeps the resolver free of assumptions about who is reading. It fires after the mutation, so re-querying from a listener sees the new state. Subscriber errors are swallowed and dispatch iterates a copy of the listener set, so one bad listener can neither break registration nor cause its neighbours to be skipped.

`SectionItemCard` holds the resolved alternate in state and rewrites it from that stream **only when the resolved value actually changes**, rather than bumping a version counter a `$derived` reads. The counter is the pattern this file already uses for `onPolicyChange`, and for policy it is fine, but for catalogs it closes a feedback loop. Re-rendering the card re-applies the `item` prop on `<pie-item-shell>`, whose registration effect re-runs and re-registers the item's catalogs, which makes the resolver emit again. One unconditional write per emission is enough to make that cycle self-sustaining: measured 1000 register/unregister rounds per item before Svelte aborted the update at its depth limit — and an aborted update leaves the DOM half-applied, so the media region mounted while the container it lives in never got its side-by-side layout. It was not confined to signing either; any page with the toolkit hit it, including TTS demos with no signing content, because every card subscribes.

Comparing before writing breaks the cycle at the only point where neither side has to know about the other: a re-registration that changes nothing resolves to the same value and stops there. The comparison is structural, because each resolution builds a fresh object and identity would report a change every time.

`onCatalogsChange` is required on the coordinator interface rather than optional. It ships with its only consumer, so there are no pre-existing host stubs to stay assignable to, and `AGENTS.md` rules out internal-API compatibility shims without a documented exception.

Any future region rendering a catalog card — a transcript region, braille, simplified language — subscribes instead of adding a second retry loop, and should guard its writes the same way for the same reason.

Still latent underneath: `<pie-item-shell>` re-dispatches registration whenever its `item` prop is re-applied, even when the value is unchanged, so any future source of card re-renders will re-register catalogs and re-attach session listeners. Harmless now that nothing feeds it in a cycle, and worth a guard on the shell's side independently.
