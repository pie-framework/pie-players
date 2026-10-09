---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-players-shared": patch
---

A feature decision no rule produced reports `rule: "none"` and `precedence: null`, in place of the `pnp-support` level it never reached. `ToolsPnpEnforcement` is renamed `PnpEnforcementMode`, the one name for the enforcement mode. The coordinator's no-assessment warning and the PNP debugger's banner now say that an item's `requiredTools` can still grant, and point at the toolkit's `assessment` property; the banner is translated, and stays hidden on the toolkit's own coordinator unless enforcement is `"on"`, as the warning does. The debugger reads placement, providers and the registry from the coordinator's bound policy inputs.
