---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
---

**Breaking.** The core no longer synthesizes a default personal-needs profile. A host that supplied none now has none.

What this does **not** change is which toolbar tools appear. Toolbar candidates come from `tools.placement`, and `PnpPolicySource` only evaluates support ids that appear somewhere in the bound policy inputs — so an empty profile blocks nothing and mandates nothing, and a placement-driven toolbar renders exactly as before. If your tools come from placement, this entry costs you nothing.

What does change is `ToolkitCoordinator.decideFeaturePolicy(supportId)`. For the 38 ids the derivation used to produce it answered `granted: true` for every host that supplied no profile, and now answers `granted: false` with reason `Feature "…" not configured`. That is the path capabilities without a toolbar placement are gated on — a host surface capability, and any host code asking "is this granted for this learner" outside a toolbar. Supply a profile if you rely on it; the one-line adoption is below.

`computeDefaultSupports()` derived the fallback profile from every registered tool's `pnpSupportIds`, which reads *registry membership* as *eligibility tier*. Registration means a capability is policy-addressable; it does not mean "universal, on by default". So an accommodation-tier capability was granted to every student of every host that supplied no profile. The remedy was `ACCOMMODATION_ONLY_SUPPORT_IDS`, a compile-time array naming `signLanguage` — which worked for the one accommodation shipped in this repo and gave a host contributing its own accommodation nothing to add to.

Which capabilities a deployment grants by default is a property of the program, not of a capability: TTS is a universal feature in one program and a documented accommodation in another. It belongs in policy configuration, alongside the district and test-administration levels that already live there.

## What changed

`@pie-players/pie-assessment-toolkit` drops `computeDefaultSupports()`, `DEFAULT_PERSONAL_NEEDS_PROFILE`, `ACCOMMODATION_ONLY_SUPPORT_IDS` and `createDefaultPersonalNeedsProfile()`. In their place, `createEmptyPersonalNeedsProfile()` returns a profile granting nothing. No alias for the old name: a function called "default" is what invited a populated default in the first place, and the rename is the signal that the return value changed.

`@pie-players/pie-default-tool-loaders` gains `UNIVERSAL_SUPPORTS_PRESET` and `createUniversalPersonalNeedsProfile()` — the 38 support ids the old derivation produced, frozen as data. Adopt it, extend it, or replace it. It is pinned by a test rather than recomputed, so a diff there is a deliberate program decision instead of a side-effect of registering a tool. It excludes any capability declaring `requiresAuthoredContent`, asserted against `registry.getContentDependentSupportIds()` rather than against a list of ids — which is what lets a host's own accommodation get the same guarantee.

`section-player` stops injecting a profile into a section that carries none. `pnpEnforcement` auto-detection engages on any non-empty profile, so the injected default silently turned enforcement on for every host — a gate whose profile granted everything, so it could not deny anything. Enforcement now engages only on real host policy material: a profile, a district policy, a test administration block, or item-level tool settings.

The PNP debugger no longer labels its fallback "toolkit default profile (derived)". Nothing derives one, and that label over an empty `supports` array read as a broken derivation rather than as an unconfigured section.

## Migration

A host that wants the previous grants adds one line at the point it builds a section or assessment:

```ts
import { createUniversalPersonalNeedsProfile } from "@pie-players/pie-default-tool-loaders";

const section = {
	...authoredSection,
	personalNeedsProfile: createUniversalPersonalNeedsProfile(),
};
```

A host already supplying `personalNeedsProfile` is unaffected. The one case that changes a toolbar: a host that relied on the implicit default *and* supplies `settings.districtPolicy` or `settings.testAdministration`. Enforcement stays on from that material, and there are now no supports to satisfy a `requiredTools` entry or to survive a `blockedTools` one.

`@pie-players/pie-item-player` consumers are unaffected — it does not depend on the toolkit.

This supersedes the statement in the sign-language catalog media region entry, which described `signLanguage` being filtered out of the computed default by id. Both the computation and the filter are gone; signing stays out of a wholesale grant because it declares a content dependency, not because it is named.
