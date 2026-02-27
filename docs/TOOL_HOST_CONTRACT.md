# Toolkit Tool Host Contract

This contract defines the minimum runtime guarantees between host components
(`pie-assessment-toolkit`, section players, shells) and toolkit-managed tools.

## Scope

- Applies to all toolkit-managed tools (`pie-tool-*`).
- Applies to shell-aware tools (item/passage/region-scoped tools).
- Does not change item player internals.

## Required Contexts

- Runtime tools must consume `assessmentToolkitRuntimeContext`.
- Shell-aware tools must also consume `assessmentToolkitShellContext`.
- Region-aware tools must also consume `assessmentToolkitRegionScopeContext`.

Use contract helpers exported from `@pie-players/pie-assessment-toolkit`:

- `connectToolRuntimeContext(host, onValue)`
- `connectToolShellContext(host, onValue)`
- `connectToolRegionScopeContext(host, onValue)`

These helpers include provider-announcement handling and retry behavior so late
provider registration is tolerated.

## Event Semantics

Cross-boundary events (tool -> host, shell -> host, host -> tool) must be:

- `bubbles: true`
- `composed: true`

Use helpers:

- `createCrossBoundaryEvent(name, detail)`
- `dispatchCrossBoundaryEvent(target, name, detail)`

## Initialization Guarantees

Tools must tolerate delayed context arrival and context re-binding:

- tool can mount before provider exists
- tool reconnects when provider becomes available
- tool cleans up subscriptions on unmount

## Host / Overlay Root Contract

Tools must not infer runtime scope from `parentElement` chains. Host/root
elements should be explicit inputs or context-derived values.

Allowed root sources:

1. explicit prop passed from host
2. region scope context (`scopeElement`)
3. shell context (`scopeElement`) as fallback

## Migration Notes

- Prefer helper-based context connection over direct `ContextConsumer` setup.
- Keep existing runtime behavior while adopting helper contracts.
- Do not switch to shadow DOM until contract migration is stable.
