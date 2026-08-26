---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-calculator": patch
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-tool-calculator-desmos": patch
---

Move Desmos per-instance configuration to the Desmos adapter package. `@pie-players/pie-calculator` now exposes provider-neutral generic `CalculatorProvider<TConfig>` and `Calculator<TConfig>` interfaces and no longer exports `DesmosCalculatorConfig` or accepts `desmos` on its base `CalculatorProviderConfig`; `@pie-players/pie-assessment-toolkit/tools/client` no longer re-exports that Desmos type either. Import `DesmosCalculatorConfig` and the new `DesmosCalculatorProviderConfig` from `@pie-players/pie-calculator-desmos` instead. The runtime shape remains `{ restrictedMode, desmos: { ... } }`, so existing calculator behavior is unchanged while custom adapters can own typed configuration without leaking provider knowledge into the generic package. The consumer dependency pad records no documented host importing these low-level configuration types, so the listed hosts are unaffected.
