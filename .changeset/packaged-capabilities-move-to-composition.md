---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-section-player": patch
---

The packaged capability set moves out of the generic toolkit into the composition layer. `@pie-players/pie-assessment-toolkit` now names no capability.

Eleven concrete registrations, the element tag map and the placement presets lived inside the generic package, so the registry and policy core knew every capability by name and a host could not contribute one without a PR against that package. They are now in `@pie-players/pie-default-tool-loaders`, which already owned the deployment's capability set for module loading.

## Moved

`createPackagedToolRegistry`, `registerPackagedTools`, `PACKAGED_TOOL_REGISTRATIONS`, the six registration modules, `PACKAGED_TOOL_TAG_MAP` (was `DEFAULT_TOOL_TAG_MAP`), `PACKAGED_TOOL_PLACEMENT`, `SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT` and `PACKAGED_TOOL_ORDER` (was `DEFAULT_TOOL_ORDER`). Each registration is also exported individually, for a host composing a subset.

Import them from `@pie-players/pie-default-tool-loaders` instead of the toolkit. Section-player already depended on that package for `DEFAULT_TOOL_MODULE_LOADERS`, so a host using the section-player elements needs no manifest change.

## Kept in the toolkit

`ToolRegistry`, the registration contract, `createDefaultToolRegistry` (now building an *empty* registry), the toolbar button/overlay helpers, `createToolElement` / `resolveToolTag` / `toToolIdFromTag`, and `DEFAULT_TOOL_PLACEMENT`, which is empty at every level. It knows `featureId`, placement levels, activation kinds and precedence rules, and knows no capability ids.

A new `@pie-players/pie-assessment-toolkit/tools/internal` entry point carries what a package needs to *write* a registration — the contract types, the context predicates, scoped-id and element helpers, the toolbar helpers, and the two provider descriptors. A separate entry point for the same reason `runtime/internal` and `policy/internal` exist: it serves sibling packages, and widening `.` with two dozen registration-authoring helpers would make each one something a host could expect us to keep. A host writing its own capability package imports from here too — the same mechanism our registrations use.

## Consequences worth knowing

**No fallback registry anywhere in the toolkit.** `ToolkitCoordinator` and `<pie-item-toolbar>` used to build a packaged registry when the host supplied none; they now use an empty one. A toolbar with no registry renders no buttons, which is the honest answer — with nothing registered there is nothing whose visibility or render contract could be consulted.

**Tool-id validation reports when it cannot run.** With no registry there is nothing to check ids against, so `normalizeAndValidateToolsConfig` emits one `tools.registryUnavailable` diagnostic at `warning` severity naming the missing registry, and skips the id, level and provider checks. Two deliberate choices there: not throwing, because that would turn an existing working host setup into a construction failure; and not skipping silently, because downgrading "your ids are valid" to "nobody looked" with no signal is how a typo reaches a learner.

`strictness: "error"` now rejects only `severity: "error"` diagnostics. Every diagnostic was `"error"` before this one, so nothing else changes.

**`resolveToolTag` has no built-in map.** It reads only the overrides it is handed, which `createPackagedToolRegistry` installs via `setComponentOverrides`. Asking for an unmapped, non-hyphenated tool id throws naming the missing mapping rather than reporting a hyphen rule the caller did not break. `ToolRegistry.renderForSurface(toolId, context)` is new and is how a host should mount a surface capability: it merges the registry's component overrides the way `renderForToolbar` always has, so a capability can resolve its element tag.

## Guard

`bun run check:capability-neutrality` fails when a capability id or `pie-tool-*` tag appears in the generic core — policy, the registry, catalog resolution, tools-config validation, the registry/tag factories. Without it the regression returns with the next capability, which is how these arrived: each reasonable on its own, each a name in a file that should not have had it. Wired into `verify:pre-commit`, `verify:ci-lint-typecheck` and `verify:publish`.

It carries one reviewable exception: the `providers.tts` → `providers.textToSpeech` migration diagnostic in tools-config validation. That is one capability's rename in generic code and a legacy shim of the kind this repo disallows outside the `pie-item` contract, but deleting it drops a useful migration error and generalising it (a `deprecatedProviderKeys` declaration on the registration) is a design change rather than part of this move.

`services/tts/**`, `TTSService`, `TTSToolProvider`, `DesmosToolProvider` and `tools/calculators/` stay in the toolkit; moving them is separate, larger work. The `pie-calculator` and `pie-tts` dependencies therefore remain — contrary to what PIE-886 assumed, they never came from the registrations. Both are interface-only packages with no dependencies of their own, imported type-only by `TTSService`, `interfaces.ts` and the provider descriptors.
