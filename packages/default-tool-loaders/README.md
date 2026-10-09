# PIE Default Tool Loaders

Composition layer for the packaged PIE assessment tools: which capabilities exist
in a deployment, and how a program tiers them.

It owns the concrete `pie-tool-*` dependencies and the calculator engines
(`pie-calculator-cortex`, `-desmos` and `-geogebra`) so toolkit core can stay
dependency-light and cycle-safe, and it is the layer above core — core knows
`featureId`, placement levels, activation kinds and precedence rules, and knows
no capability ids.

It owns five things, all answers to "which capabilities does this deployment have
and how does the program tier them":

| Export | What it decides |
| --- | --- |
| `PACKAGED_TOOL_REGISTRATIONS`, `createPackagedToolRegistry`, `registerPackagedTools` | Which capabilities exist, and their toolbar and surface contracts |
| `PACKAGED_TOOL_TAG_MAP` | Which custom element each one renders as |
| `PACKAGED_TOOL_PLACEMENT`, `SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT`, `PACKAGED_TOOL_ORDER` | Where they appear and in what order |
| `UNIVERSAL_SUPPORTS_PRESET`, `createUniversalPersonalNeedsProfile` | Which of them the program grants to everyone |
| `DEFAULT_TOOL_MODULE_LOADERS`, `registerDefaultToolModuleLoaders` | When each one's bundle loads |

The individual registrations are exported too, so a host can compose its own set
rather than take the packaged one whole.

These exports are projections of one internal **Packaged Capability
Composition**. Each packaged capability is authored once with its registration,
element delivery, module loader, placement/order membership and explicit
universal-support policy. The package build rejects contradictory PIE-owned data
— for example, a region capability with a toolbar tag, or a content-dependent
capability marked universal — so release tests find a missing facet
instead of a learner finding a dead affordance. The browser does not repeat that
strict gate at import time: a PIE authoring defect must block publication, not an
otherwise usable assessment.

That invariant boundary does not make host input stricter: lazy module loading
is opt-in, registration/tag/factory overrides take precedence, an empty
`toolIds` array selects the full packaged set, and unknown selected ids are
ignored while known ids register.

## Usage

```ts
import {
	createPackagedToolRegistry,
	DEFAULT_TOOL_MODULE_LOADERS,
} from "@pie-players/pie-default-tool-loaders";

// The packaged capability set, lazily loaded.
const registry = createPackagedToolRegistry({
	toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS,
});
```

One loader set serves every host shape. `DEFAULT_TOOL_MODULE_LOADERS` holds a
loader per packaged capability, and a registry loads a module only when a tool
first renders, so an item player, a section player and an assessment player
pass the same set and load only the tools they place.

The calculator is one element, `<pie-tool-calculator>`, for every provider.
Desmos is the provider when none is configured; the toolkit picks another from
`tools.providers.calculator` when the element mounts, and an open calculator
remounts on the new provider when a tool-config update replaces it.

```ts
const tools = {
	providers: {
		calculator: {
			provider: {
				id: "calculator-geogebra",
				init: { appletTimeoutMs: 20_000 },
			},
			settings: { showResetIcon: true },
		},
	},
};
```

For an offline-capable calculator with no API key or runtime CDN, use
`provider.id: "calculator-cortex"`. Its `settings` accept angle mode, precision,
history, evaluation limit, allowed functions, clipboard policy, and graph
viewport options documented by `@pie-players/pie-calculator-cortex`.

A host composing its own set starts from the toolkit's empty `ToolRegistry`,
registers into it, and installs the tag map its registrations create elements
from.

```ts
import { ToolRegistry } from "@pie-players/pie-assessment-toolkit";
import {
	calculatorToolRegistration,
	PACKAGED_TOOL_TAG_MAP,
	registerDefaultToolModuleLoaders,
	ttsToolRegistration,
} from "@pie-players/pie-default-tool-loaders";

const registry = new ToolRegistry();
registry.register(calculatorToolRegistration);
registry.register(ttsToolRegistration);
registry.setComponentOverrides({ toolTagMap: PACKAGED_TOOL_TAG_MAP });
registerDefaultToolModuleLoaders(registry);
```

`registerDefaultToolModuleLoaders` installs a loader for every packaged tool;
its `loaders` option adds or replaces entries. A replacement registered after a
tool's module has loaded is ignored with a warning, since the elements it
defines are already in place.

## Content-dependent capabilities require an explicit packaging decision

A content-dependent capability is never inferred into
`UNIVERSAL_SUPPORTS_PRESET`. It may ship in `PACKAGED_TOOL_REGISTRATIONS` only
when it has a useful presentation path without a grant and declares
`resolvesWithoutGrant`. Audio transcript is the shipped example: an authored
`visibility: "always"` transcript reaches every player, while its accommodation
path remains policy-gated and `transcript` stays out of the universal preset.

A content-dependent capability with no presentation path remains an explicit
deployment choice. Signing is the shipped example: install
`@pie-players/pie-tool-sign-language` and register it, which is the same two
lines a host writes for a capability of its own.

```ts
import { signLanguageRegistration } from "@pie-players/pie-tool-sign-language";

registry.register(signLanguageRegistration);
```

## Universal supports preset

`createUniversalPersonalNeedsProfile()` builds a `PersonalNeedsProfile` granting
`UNIVERSAL_SUPPORTS_PRESET` — the tool ids of the capabilities the packaged set
treats as universal features. A support id is the tool id it grants.

```ts
import { createUniversalPersonalNeedsProfile } from "@pie-players/pie-default-tool-loaders";

const section = {
	...authoredSection,
	personalNeedsProfile: createUniversalPersonalNeedsProfile(),
};
```

The core ships no populated default — `createEmptyPersonalNeedsProfile()` in
`@pie-players/pie-assessment-toolkit/tools/registration` grants nothing. Which capabilities a
deployment grants by default is a property of the program, not of a capability:
TTS is a universal feature in one program and a documented accommodation in
another. So the preset is data to adopt, extend or replace alongside the district
and test-administration configuration, and it deliberately excludes any
capability that declares a content dependency.

A section carrying no profile is left alone. `pnpEnforcement` auto-detection
engages on real host policy material, so supplying no profile means placement
alone decides which tools appear.
