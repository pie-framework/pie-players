---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

`onCatalogsChange` on the catalog resolver and the toolkit coordinator, replacing a timed retry in the item card's signing region.

A reader that *renders* a catalog card has to answer "is there content for this item" before the catalogs exist: registration is driven by an item shell's mount event, which lands after a card rendered alongside that item has already computed its first answer. TTS never hit this because it resolves by DOM lookup at the moment it speaks. The signing region did, and it compensated with a bounded retry — 20 attempts, 50 ms apart — after which it stopped for good. No budget is right for that: a second is too short when element bundles load slowly, and running out of it left an eligible learner with no signing video and nothing logged. An accommodation that fails this way is invisible to everyone except the person who needed it.

`AccessibilityCatalogResolver.onCatalogsChange(listener)` now reports registrations and removals, with `ToolkitCoordinator.onCatalogsChange` delegating to it exactly as `onPolicyChange` delegates to the policy engine. The event names what changed (`scoped-registered`, `scoped-removed`, `item-added`, `item-cleared`) and carries the owner context for the scoped reasons, but no resolved cards: listeners re-query with their own lookup context, which keeps the resolver free of assumptions about who is reading. It fires after the mutation, so re-querying from a listener sees the new state. Subscriber errors are swallowed and dispatch iterates a copy of the listener set, so one bad listener can neither break registration nor cause its neighbours to be skipped.

`SectionItemCard` now bumps a version counter from that stream, which is the pattern already used in the same file for `onPolicyChange` and in `<pie-item-toolbar>` and the section-player base element. Policy and catalogs are the two mutable inputs a catalog-backed capability depends on, and they are now observed the same way.

`onCatalogsChange` is required on the coordinator interface rather than optional. It ships with its only consumer, so there are no pre-existing host stubs to stay assignable to, and `AGENTS.md` rules out internal-API compatibility shims without a documented exception.

Any future region rendering a catalog card — a transcript region, braille, simplified language — subscribes instead of adding a second retry loop.
