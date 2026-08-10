---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
---

**Breaking.** The core no longer synthesizes a default personal-needs profile. A host that supplied no profile and relied on the derived one will see grants disappear, which is the point of the change.

`computeDefaultSupports()` derived the fallback profile from every registered tool's `pnpSupportIds`, which reads *registry membership* as *eligibility tier*. Registration means a capability is policy-addressable; it does not mean "universal, on by default". So an accommodation-tier capability was granted to every student of every host that supplied no profile. The remedy was `ACCOMMODATION_ONLY_SUPPORT_IDS`, a compile-time array naming `signLanguage` — which worked for the one accommodation shipped in this repo and gave a host contributing its own accommodation nothing to add to.

Which capabilities a deployment grants by default is a property of the program, not of a capability: TTS is a universal feature in one program and a documented accommodation in another. It belongs in policy configuration, alongside the district and test-administration levels that already live there.

## What changed

`@pie-players/pie-assessment-toolkit` drops `computeDefaultSupports()`, `DEFAULT_PERSONAL_NEEDS_PROFILE`, `ACCOMMODATION_ONLY_SUPPORT_IDS` and `createDefaultPersonalNeedsProfile()`. In their place, `createEmptyPersonalNeedsProfile()` returns a profile granting nothing. No alias for the old name: a function called "default" is what invited a populated default in the first place, and the rename is the signal that the return value changed.

`@pie-players/pie-default-tool-loaders` gains `UNIVERSAL_SUPPORTS_PRESET` and `createUniversalPersonalNeedsProfile()` — the 38 support ids the old derivation produced, frozen as data. Adopt it, extend it, or replace it. It is pinned by a test rather than recomputed, so a diff there is a deliberate program decision instead of a side-effect of registering a tool. It deliberately excludes any capability with a content dependency; that assertion currently checks `signLanguage` by id and moves onto the `requiresAuthoredContent` declaration when that lands.

`section-player` stops injecting a profile into a section that carries none. This is the substantive behaviour change and it reaches further than the grant set: `pnpEnforcement` auto-detection engages on any non-empty profile, so the injected default silently turned PNP gates on for every host. Enforcement now engages only on real host policy material — a profile, a district policy, a test administration block, or item-level tool settings. A section with no profile has its tools decided by placement alone, which is what a host that configured no policy was asking for.

The PNP debugger shows an empty profile where it previously showed the derived one, which is the truthful answer to "what profile is in play".

## Migration

A host that wants the previous grants adds one line at the point it builds a section or assessment:

```ts
import { createUniversalPersonalNeedsProfile } from "@pie-players/pie-default-tool-loaders";

const section = {
	...authoredSection,
	personalNeedsProfile: createUniversalPersonalNeedsProfile(),
};
```

A host already supplying `personalNeedsProfile`, `settings.districtPolicy` or `settings.testAdministration` is unaffected. A host relying on the implicit default *and* supplying district or test-administration material is the one case that changes visibly: enforcement stays on, and there are now no supports to satisfy it.

`@pie-players/pie-item-player` consumers are unaffected — it does not depend on the toolkit.

This supersedes the statement in the sign-language catalog media region entry, which described `signLanguage` being filtered out of the computed default by id. Both the computation and the filter are gone; signing stays out of a wholesale grant because it declares a content dependency, not because it is named.
