---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-calculator": patch
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-tool-calculator-desmos": patch
---

Move Desmos per-instance configuration to the Desmos adapter package, and align the calculator contract with the TTS one. `@pie-players/pie-calculator` no longer exports the Desmos settings type or accepts `desmos` on `CalculatorProviderConfig`; import `DesmosCalculatorSettings` and `DesmosCalculatorProviderConfig` from `@pie-players/pie-calculator-desmos` instead.

`CalculatorProvider` and `Calculator` stay un-parameterized, matching `ITTSProvider` in `@pie-players/pie-tts`. An adapter extends `CalculatorProviderConfig` and narrows `createCalculator`'s argument in its own class signature, which is what gives a caller holding the concrete provider the precise type; a type parameter on the interface would add nothing, since a provider narrowing that argument satisfies it either way. `CalculatorProvider.initialize` now takes an optional `CalculatorProviderInit` — vendor credentials and an instrumentation callback — so a provider that authenticates is describable by the contract rather than by a structural mirror. `DesmosToolProvider` is typed by `CalculatorProvider` from the contract package, the way `TTSToolProvider` is typed by `ITTSProvider`, and reaches `@pie-players/pie-calculator-desmos` only inside a method body: that package is an optional peer, and a top-level type import from it would reach the toolkit's published declarations and make the optional peer required for anyone type-checking without `skipLibCheck`.

The runtime shape is `{ restrictedMode, settings: { … } }`, one vendor-neutral field for every adapter, so an adapter can own typed configuration without leaking provider knowledge into the generic package. The consumer dependency pad records no documented host importing any calculator type, so the listed hosts are unaffected.
