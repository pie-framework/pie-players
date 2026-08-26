---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-calculator": patch
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-tool-calculator-desmos": patch
---

Move Desmos per-instance configuration to the Desmos adapter package. `@pie-players/pie-calculator` no longer exports `DesmosCalculatorConfig` or accepts `desmos` on its base `CalculatorProviderConfig`, and `CalculatorProvider` takes a `TConfig` parameter naming the per-instance configuration an adapter accepts; `@pie-players/pie-assessment-toolkit/tools/client` no longer re-exports that Desmos type either. Import `DesmosCalculatorConfig` and the new `DesmosCalculatorProviderConfig` from `@pie-players/pie-calculator-desmos` instead. `Calculator` stays un-parameterized, since no member of it varies with the configuration type.

`DesmosToolProvider` describes what it needs from the adapter as `DesmosCalculatorProviderApi`, written against the `pie-calculator` contract rather than imported from `@pie-players/pie-calculator-desmos`: that package is an optional peer, and a top-level type import from it would reach the toolkit's published declarations and make the optional peer required for anyone type-checking without `skipLibCheck`.

The runtime shape remains `{ restrictedMode, desmos: { … } }`, so existing calculator behavior is unchanged while custom adapters can own typed configuration without leaking provider knowledge into the generic package. The consumer dependency pad records no documented host importing any calculator type, so the listed hosts are unaffected.
