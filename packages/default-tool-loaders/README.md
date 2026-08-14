# PIE Default Tool Loaders

Composition layer for the packaged PIE assessment tools: which capabilities exist
in a deployment, and how a program tiers them.

It owns the concrete `pie-tool-*` dependencies so toolkit core can stay
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
| `UNIVERSAL_SUPPORTS_PRESET`, `createUniversalPersonalNeedsProfile` | Which of their support ids the program grants to everyone |
| `DEFAULT_TOOL_MODULE_LOADERS`, `registerSectionToolModuleLoaders` | When each one's bundle loads |

The individual registrations are exported too, so a host can compose its own set
rather than take the packaged one whole.

These exports are projections of one internal **Packaged Capability
Composition**. Each packaged capability is authored once with its registration,
element delivery, loader bootstrap sets, placement/order membership and explicit
universal-support policy. The package build rejects contradictory PIE-owned data
— for example, a region capability with a toolbar tag, or a universal support
id its registration does not declare — so release tests find a missing facet
instead of a learner finding a dead affordance. The browser does not repeat that
strict gate at import time: a PIE authoring defect must block publication, not an
otherwise usable assessment.

That invariant boundary does not make host input stricter. The existing public
factory and constants are unchanged: lazy module loading remains opt-in,
registration/tag/factory overrides retain precedence, an empty `toolIds` array
still selects the full packaged set, and unknown selected ids are ignored while
known ids continue to register.

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

`createDefaultToolRegistry()` in the toolkit is the other end of that choice: it
builds an empty registry, and a host composing its own set registers into it.

```ts
import { createDefaultToolRegistry } from "@pie-players/pie-assessment-toolkit";
import {
	calculatorToolRegistration,
	registerSectionToolModuleLoaders,
	ttsToolRegistration,
} from "@pie-players/pie-default-tool-loaders";

const registry = createDefaultToolRegistry({
	registrations: [calculatorToolRegistration, ttsToolRegistration],
});
// Section-only loaders, for section toolbar bootstrap points.
registerSectionToolModuleLoaders(registry);
```

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
`UNIVERSAL_SUPPORTS_PRESET` — the support ids the packaged tool set treats as
universal features.

```ts
import { createUniversalPersonalNeedsProfile } from "@pie-players/pie-default-tool-loaders";

const section = {
	...authoredSection,
	personalNeedsProfile: createUniversalPersonalNeedsProfile(),
};
```

The core ships no populated default — `createEmptyPersonalNeedsProfile()` in
`@pie-players/pie-assessment-toolkit` grants nothing. Which capabilities a
deployment grants by default is a property of the program, not of a capability:
TTS is a universal feature in one program and a documented accommodation in
another. So the preset is data to adopt, extend or replace alongside the district
and test-administration configuration, and it deliberately excludes any
capability that declares a content dependency.

A section carrying no profile is left alone. `pnpEnforcement` auto-detection
engages on real host policy material, so supplying no profile means placement
alone decides which tools appear.
