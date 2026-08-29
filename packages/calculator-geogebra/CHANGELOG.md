# @pie-players/pie-calculator-geogebra

## 0.3.70

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.70

## 0.3.69

### Patch Changes

- af438ca: Destroy the calculators a provider created when the provider is destroyed.
  
  `destroy()` is a host's one call to release a calculator provider, and both
  adapters released only their own fields: every calculator they had handed out
  stayed mounted, with its vendor instance running and its container populated. A
  host that swaps providers, or tears a section down without walking its
  calculators first, leaked all of them. Both providers now track live instances
  and destroy them, matching the Cortex adapter, and each calculator is destroyed
  at most once however many times it is asked.
  
  The Desmos adapter's four `console.log` calls are gone. The warnings that carry
  a diagnostic — the legacy unkeyed URL, a failed `setState`, a failed `focus`, a
  throwing telemetry callback — stay.
- cb99eae: Give the three calculator adapters one naming and narrowing convention.
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
- 8bb668b: Add a separately packaged GeoGebra calculator suite with provider, full tool,
  inline trigger, tests, documentation, and a section-player demo. Basic requests
  map to GeoGebra Scientific, while scientific and graphing use their matching
  embedded apps.
  
  Move calculator lifecycle and UI into a provider-neutral shared package, keep
  vendor settings in their implementation packages, and select implementations
  through the same `provider.init`, `provider.runtime`, and `settings` schema.
  Desmos remains the no-configuration default and preserves its unkeyed legacy
  load and runtime `proxyEndpoint` initialization for existing clients. The
  packaged composition selects the GeoGebra element and lazy bundle from the same
  provider config used by the toolkit.
  
  Document that PIE bundles only MIT-licensed adapter code, not either vendor
  application. Clarify the separate Desmos and GeoGebra license obligations,
  runtime credential boundary, attribution, and self-hosting restrictions.
- Updated dependencies [cb99eae]
- Updated dependencies [8bb668b]
- Updated dependencies [3544e9d]
  - @pie-players/pie-calculator@0.3.69
