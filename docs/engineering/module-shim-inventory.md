# Module Shim Inventory

This inventory tracks ambient module shims used to support dynamic tool imports and the target state for removing those shims.

## Shim Declaration Files

- `packages/assessment-toolkit/src/types/tool-module-shims.d.ts`
- `packages/assessment-toolkit/src/types/tool-module-loaders.d.ts`

## Module Matrix

| Module | Declared In | Dynamic Import Usage | Owning Package | Status |
| --- | --- | --- | --- | --- |
| `@pie-players/pie-tool-text-to-speech` | `tool-module-shims.d.ts`, `tool-module-loaders.d.ts` | `packages/assessment-toolkit/src/tools/default-tool-module-loaders.ts`, `packages/default-tool-loaders/src/index.ts` | `packages/tool-text-to-speech` | B (typed entry exists, shim still used) |
| `@pie-players/pie-tool-tts-inline` | `tool-module-shims.d.ts`, `tool-module-loaders.d.ts` | `packages/assessment-toolkit/src/tools/default-tool-module-loaders.ts` | `packages/tool-tts-inline` | B |
| `@pie-players/pie-tool-calculator-desmos` | `tool-module-shims.d.ts`, `tool-module-loaders.d.ts` | `packages/assessment-toolkit/src/tools/default-tool-module-loaders.ts`, `packages/default-tool-loaders/src/index.ts` | `packages/tool-calculator-desmos` | B |
| `@pie-players/pie-calculator-desmos` | `tool-module-loaders.d.ts` | `packages/assessment-toolkit/src/services/tool-providers/DesmosToolProvider.ts` | `packages/calculator-desmos` | B |
| `@pie-players/tts-client-server` | `tool-module-loaders.d.ts` | `packages/assessment-toolkit/src/services/tool-providers/TTSToolProvider.ts` | `packages/tts-client-server` | B |
| `@pie-players/pie-tool-answer-eliminator` | `tool-module-shims.d.ts`, `tool-module-loaders.d.ts` | `packages/default-tool-loaders/src/index.ts` | `packages/tool-answer-eliminator` | C (subpath export targets source) |
| `@pie-players/pie-tool-annotation-toolbar` | `tool-module-loaders.d.ts` | `packages/default-tool-loaders/src/index.ts` | `packages/tool-annotation-toolbar` | B |
| `@pie-players/pie-tool-graph` | `tool-module-loaders.d.ts` | `packages/default-tool-loaders/src/index.ts` | `packages/tool-graph` | B |
| `@pie-players/pie-tool-line-reader` | `tool-module-loaders.d.ts` | `packages/default-tool-loaders/src/index.ts` | `packages/tool-line-reader` | B |
| `@pie-players/pie-tool-periodic-table` | `tool-module-loaders.d.ts` | `packages/default-tool-loaders/src/index.ts` | `packages/tool-periodic-table` | B |
| `@pie-players/pie-tool-protractor` | `tool-module-loaders.d.ts` | `packages/default-tool-loaders/src/index.ts` | `packages/tool-protractor` | B |
| `@pie-players/pie-tool-ruler` | `tool-module-loaders.d.ts` | `packages/default-tool-loaders/src/index.ts` | `packages/tool-ruler` | B |
| `@pie-players/pie-tool-theme` | `tool-module-loaders.d.ts` | `packages/default-tool-loaders/src/index.ts` | `packages/tool-theme` | B |

## Classification

- `A`: Export/typing contract is complete and shim can be removed immediately.
- `B`: Module resolves and is typed, but currently depends on ambient shim declarations in consumers.
- `C`: Export contract issue exists and must be fixed before shim removal.

## Immediate Actions

1. Fix `tool-answer-eliminator` subpath export to `dist`.
2. Remove stale declarations from `assessment-toolkit` shim files for modules no longer imported in `assessment-toolkit`.
3. Remove both shim files once `assessment-toolkit` and `default-tool-loaders` typecheck without ambient declarations.
