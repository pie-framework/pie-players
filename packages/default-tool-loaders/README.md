# PIE Default Tool Loaders

Composition layer for the packaged PIE assessment tools: which capabilities exist
in a deployment, and how a program tiers them.

It owns the concrete `pie-tool-*` dependencies so toolkit core can stay
dependency-light and cycle-safe, and it is the layer above core — core knows
`featureId`, placement levels, activation kinds and precedence rules, and knows
no capability ids.

Today that means the lazy module loader mappings plus the universal-supports
preset; the packaged tool registrations move here next (PIE-886).

## Usage

```ts
import { createDefaultToolRegistry } from "@pie-players/pie-assessment-toolkit";
import {
	DEFAULT_TOOL_MODULE_LOADERS,
	registerSectionToolModuleLoaders,
} from "@pie-players/pie-default-tool-loaders";

// Full default loaders (item + section tools)
const registry = createDefaultToolRegistry({
	toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS,
});

// Section-only loaders (for section toolbar bootstrap points)
registerSectionToolModuleLoaders(registry);
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

