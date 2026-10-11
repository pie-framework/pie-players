# PIE Default Tool Loaders

The packaged PIE assessment tools: which capabilities exist in a deployment, how
they load, and which of them a program grants to everyone. This README is for
host integrators choosing a tool set and a calculator, and for contributors
adding a packaged capability.

The package owns the concrete `pie-tool-*` dependencies and the calculator
engines (`pie-calculator-cortex`, `-desmos` and `-geogebra`), so toolkit core
stays dependency-light and cycle-safe. Core knows the concepts — support ids,
placement levels, activation kinds and precedence rules — and no concrete
capability id. A support id is the tool id a profile grants.

| Export | What it decides |
| --- | --- |
| `PACKAGED_TOOL_REGISTRATIONS`, `createPackagedToolRegistry` | Which capabilities exist, and their toolbar and surface contracts |
| `PACKAGED_TOOL_TAG_MAP` | Which custom element each one renders as |
| `SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT` | Where they appear and in what order |
| `createUniversalPersonalNeedsProfile`, `createEmptyPersonalNeedsProfile` | Which of them the program grants to everyone, or to no one |
| `DEFAULT_TOOL_MODULE_LOADERS` | When each one's bundle loads |
| `CONTENT_ALTERNATE_REGISTRATIONS` | Which of them carry an authored alternate that renders as a region; the print player mounts these |

The individual registrations are exported too, so a host can compose its own
set ([Custom sets](#custom-sets)).

## Usage

```ts
import { createPackagedToolRegistry } from "@pie-players/pie-default-tool-loaders";

// The packaged capability set, lazily loaded.
const registry = createPackagedToolRegistry();

// The same registrations for a host that defines the tool elements itself.
const preloaded = createPackagedToolRegistry({ toolModuleLoaders: {} });
```

One loader set serves every host shape. `DEFAULT_TOOL_MODULE_LOADERS` holds a
loader per packaged capability and is what `createPackagedToolRegistry`
installs unless `toolModuleLoaders` replaces it. A registry loads a module only
when a tool first renders, so an item player, a section player and an
assessment player share the set and load only the tools they place.

`createPackagedToolRegistry` is lenient with host input. Registration, tag-map
and component-factory overrides take precedence over the packaged data. An
empty `toolIds` array selects the full packaged set, and unknown ids in it are
ignored while the known ones register.

## Calculator providers

The calculator is one element, `<pie-tool-calculator>`, for every provider. The
toolkit picks the provider from `tools.providers.calculator` when the element
mounts, and an open calculator remounts on the new provider when a tool-config
update replaces it.

Desmos is the provider when none is configured, and it needs an API key: pass
it through `provider.runtime.authFetcher`, a `provider.init.proxyEndpoint` that
returns it, or `provider.init.apiKey` in development
([Calculator with host auth](../../docs/tools-and-accomodations/tool_provider_system.md#calculator-with-host-auth)).
Without one the calculator fails to load. For a keyless, offline-capable
calculator with no runtime CDN, use `provider.id: "calculator-cortex"`. Its
`settings` take the `CortexCalculatorSettings` type that
`@pie-players/pie-calculator-cortex` exports: `angleMode`,
`calculationPrecision`, `displayPrecision`, `historyLimit`,
`evaluationTimeLimitMs`, `allowedFunctions`, `allowClipboard`, `messages`,
`direction` and `graph`. Clipboard blocking follows `restrictedMode`;
`allowClipboard` alone blocks nothing. The [Cortex README](../calculator-cortex/README.md)
covers localization, message overrides and the keypad.

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

## Custom sets

A host composing its own set starts from the toolkit's empty `ToolRegistry`,
registers into it, and installs the tag map its registrations create elements
from.

```ts
import { ToolRegistry } from "@pie-players/pie-assessment-toolkit";
import {
	calculatorToolRegistration,
	DEFAULT_TOOL_MODULE_LOADERS,
	PACKAGED_TOOL_TAG_MAP,
	ttsToolRegistration,
} from "@pie-players/pie-default-tool-loaders";

const registry = new ToolRegistry();
registry.register(calculatorToolRegistration);
registry.register(ttsToolRegistration);
registry.setComponentOverrides({ toolTagMap: PACKAGED_TOOL_TAG_MAP });
registry.setToolModuleLoaders(DEFAULT_TOOL_MODULE_LOADERS);
```

A later `setToolModuleLoaders` call adds or replaces entries. A replacement
registered after a tool's module has loaded is ignored with a warning, since the
elements it defines are already in place.

## Content-dependent capabilities

A content-dependent capability declares `requiresAuthoredContent`: it renders
only where the content carries what it needs, and
`createUniversalPersonalNeedsProfile()` never grants one. It ships in
`PACKAGED_TOOL_REGISTRATIONS` only when it has a useful presentation path
without a grant and declares `resolvesWithoutGrant`. Audio transcript is the
shipped example: an authored `visibility: "always"` transcript reaches every
player, while its accommodation path stays policy-gated and `transcript` stays
out of the universal profile.

A content-dependent capability with no such path is an explicit deployment
choice. Signing is the shipped example: install
`@pie-players/pie-tool-sign-language` and register it, the same two lines a
host writes for a capability of its own.

```ts
import { signLanguageRegistration } from "@pie-players/pie-tool-sign-language";

registry.register(signLanguageRegistration);
```

## Universal and empty profiles

`createUniversalPersonalNeedsProfile()` builds a fresh `PersonalNeedsProfile`
granting the tool ids of the capabilities the packaged set treats as universal
features. Tool policy reads the profile from the assessment entity, so set it
there: on the player's `assessment` property, or through
`coordinator.updateAssessment(...)` on a coordinator you pass. A
`section.personalNeedsProfile` is ignored with a console warning.

```ts
import { createUniversalPersonalNeedsProfile } from "@pie-players/pie-default-tool-loaders";

sectionPlayer.assessment = {
	...authoredAssessment,
	personalNeedsProfile: createUniversalPersonalNeedsProfile(),
};
```

The toolkit ships no populated default, and `createEmptyPersonalNeedsProfile()`
builds a profile granting nothing. Which capabilities a deployment grants by
default is a property of the program: TTS is a universal feature in one program
and a documented accommodation in another. The universal profile is data to
adopt, extend or replace alongside the district and test-administration
configuration, and it excludes every capability that declares a content
dependency.

An assessment carrying no profile is left alone. `pnpEnforcement`
auto-detection engages only on host policy material, so with no profile,
placement alone decides which tools appear.

## Packaged capability composition

The exports are projections of one internal composition. Each packaged
capability is authored once with its registration, element delivery, module
loader, preferred placement and explicit universal-support flag.

The package build rejects contradictory PIE-owned data, such as a region
capability with a toolbar tag or a content-dependent capability marked
universal, so release tests catch a missing facet before it ships. The browser
skips that strict check at import time: a PIE authoring defect blocks
publication and never an otherwise usable assessment.
