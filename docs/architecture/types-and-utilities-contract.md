# Types and Utilities Contract

This is the canonical ownership and naming reference for shared contracts.  
Pre-v1 policy applies: **no compatibility aliases** and **no transitional re-exports**.

## Breaking Rename Matrix

| Old symbol | New symbol | Canonical location |
| --- | --- | --- |
| `II18nService` | `I18nServiceApi` | `packages/players-shared/src/i18n/types.ts` |
| `IThemeProvider` | `ThemeProviderApi` | `packages/assessment-toolkit/src/services/interfaces.ts` |
| `IHighlightCoordinator` | `HighlightCoordinatorApi` | `packages/assessment-toolkit/src/services/interfaces.ts` |
| `IToolCoordinator` | `ToolCoordinatorApi` | `packages/assessment-toolkit/src/services/interfaces.ts` |
| `ITTSService` | `TtsServiceApi` | `packages/assessment-toolkit/src/services/interfaces.ts` |
| `IAccessibilityCatalogResolver` | `AccessibilityCatalogResolverApi` | `packages/assessment-toolkit/src/services/interfaces.ts` |
| `IElementToolStateStore` | `ElementToolStateStoreApi` | `packages/assessment-toolkit/src/services/interfaces.ts` |
| `IToolkitCoordinator` | `ToolkitCoordinatorApi` | `packages/assessment-toolkit/src/services/interfaces.ts` |
| `IToolProvider` | `ToolProviderApi` | `packages/assessment-toolkit/src/services/tool-providers/ToolProviderApi.ts` |
| `PNPToolResolver` | `PnpToolResolver` | `packages/assessment-toolkit/src/services/PNPToolResolver.ts` |
| `PNPResolutionProvenance` | `PnpResolutionProvenance` | `packages/assessment-toolkit/src/services/pnp-provenance.ts` |
| `PNPProvenanceBuilder` | `PnpProvenanceBuilder` | `packages/assessment-toolkit/src/services/pnp-provenance.ts` |

## Type Ownership

| Symbol(s) | Canonical owner | Status |
| --- | --- | --- |
| `DeleteDone`, `ImageHandler`, `SoundHandler` | `@pie-players/pie-players-shared/types` | Unified and consumed from shared owner |
| `ToolProviderApi`, `ToolProviderCapabilities`, `ToolCategory` | `assessment-toolkit` tool-provider contracts | Unified under single provider contract file |
| Section controller runtime/session contracts | `assessment-toolkit/services/section-controller-types.ts` | Owner is established; section-player convergence remains follow-up |

## Utility Ownership

| Utility | Canonical owner | Status |
| --- | --- | --- |
| `ZIndexLayer` | `@pie-players/pie-assessment-toolkit` | `section-player` now imports canonical enum |

## Naming and Style Rules

- No `I*` interface prefix in newly touched code.
- Acronym normalization uses Pascal-word symbols (`Pnp`, `Pie`, `Tts`).
- Booleans use `is*`, `has*`, `can*`, or `should*`.
- Events use `*-changed` for post-state transitions and `*-change` for intent/pre-change events.
- Prefer `import type` for type-only imports.

## Validation Gates

- `bun run --cwd packages/assessment-toolkit typecheck`
- `bun run --cwd packages/section-player typecheck`
- `bun run --cwd packages/item-player check`
- `bun run lint:biome`
- `bun run check:source-exports`
- `bun run check:consumer-boundaries`
- `bun run check:custom-elements`
