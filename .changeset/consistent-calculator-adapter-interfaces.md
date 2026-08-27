---
"@pie-players/pie-calculator": patch
"@pie-players/pie-calculator-cortex": patch
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-calculator-geogebra": patch
"@pie-players/pie-assessment-toolkit": patch
---

Give the three calculator adapters one naming and narrowing convention.
`<Vendor>CalculatorSettings` is the vendor option shape,
`<Vendor>CalculatorProviderConfig` is `CalculatorProviderConfig` with `settings`
narrowed to it, and `<Vendor>CalculatorProviderInit` exists only where the
adapter narrows `CalculatorProviderInit`. Cortex already had all three and is the
model; the rule is stated on the two contract interfaces so a host reading one
adapter knows where to look in the others.

GeoGebra's `GeoGebraCalculatorProviderConfig` typed its `initialize()` argument
while the identically-suffixed Desmos type typed `createCalculator()` -- the same
name for opposite lifecycles in sibling packages a host picks between. It is now
`GeoGebraCalculatorProviderInit`, extends `Pick<CalculatorProviderInit,
"onTelemetry">` rather than redeclaring that callback, and the freed name types
`createCalculator()`'s argument as it does elsewhere. GeoGebra's embed takes no
credential, so the narrowing is what says `apiKey` and `proxyEndpoint` cannot be
honoured there, and narrowing `createCalculator` removed an
`as GeoGebraCalculatorSettings` cast.

Desmos's `DesmosCalculatorConfig` is renamed `DesmosCalculatorSettings`, since it
is the settings shape and the other two adapters already said so. It takes
`CalculatorProviderInit` whole -- Desmos is the one adapter that needs a
credential -- so it declares no init alias, and the contract records that as the
rule rather than an omission.

Cortex exported `CortexCalculatorProviderInit` but typed `initialize()` with the
un-narrowed contract type, so `initialize({ apiKey })` compiled against a local
engine that has nothing to authenticate. The signature now uses the narrowed
type.

No consumer breaks: verified against all three consumer checkouts on 2026-08-27,
none of which imports any calculator type, and no checkout offers GeoGebra.
