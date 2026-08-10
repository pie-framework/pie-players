---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

Section-player's section-scoped overlay is registry-driven. It no longer names `annotationToolbar`.

`PieSectionPlayerBaseElement.svelte` named that tool id in three places — the policy check, the module load and the `<pie-tool-annotation-toolbar>` element — so a host could not contribute a second section-scoped capability without a PR against this repo. The base element now offers a named surface, `section-overlay`, and asks `registry.getToolsBySurface("section-overlay")` what can fill it. Nothing in section-player names a capability, an element tag, or a package.

`annotationToolbarRegistration` declares `surfaces: ["section-overlay"]` and owns the mounting it used to have done for it: resolving its element tag through the component-override map, setting `enabled`, `ttsService` and `highlightCoordinator`, and returning a `sync` so a policy change reapplies props instead of remounting. Remounting would drop the element's own state and, for a selection gateway, the learner's current selection. It keeps `activation: "selection-gateway"` and its `renderToolbar`, so nothing about the toolbar path changes.

Three behaviours the generic path has to keep, and does:

- **Same grant check.** The three-level `decideToolPolicy` sweep over section, item and passage runs per discovered capability against its own `toolId`, with the same scope shape, so a custom `PolicySource` reading `assessmentId` cannot disagree with a toolbar's verdict for the same level.
- **Same module gating.** A capability stays unmounted until `ensureToolModuleLoaded` resolves and its element is defined, so an optional package that is not installed leaves the surface empty rather than mounting an undefined element. The registration declines by returning `null` if its tag is still unknown.
- **One instance.** The mount effect reconciles against what is already mounted, so a capability that stays granted is never torn down and remounted, and one that loses its grant is unmounted and destroyed.

A capability returning `null` from `renderSurface` means "nothing to show", which is a legitimate answer and not an error. One throwing is logged against its tool id and skipped, so a broken capability cannot take the surface down with it.

The mount point is an always-present `<div data-pie-tool-surface="section-overlay">` inside `<pie-assessment-toolkit>`, so a capability granted mid-session has somewhere to land and the toolkit's context requests still bubble to the provider from a mounted element.
