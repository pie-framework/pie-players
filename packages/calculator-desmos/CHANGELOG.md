# @pie-players/pie-calculator-desmos

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
- eb3aed9: Stop `restrictedMode` from removing a graphing calculator's only input.
  
  The Desmos adapter mapped `restrictedMode: true` to `expressions: false` along
  with the chrome flags. On a `GraphingCalculator` that removes the whole expression
  list, so a restricted graphing calculator was graph paper with no way to enter a
  function — the exact call this package's README documents. Basic and scientific
  never noticed: `expressions` is a graphing option their constructors ignore. It was
  also the odd one out among the three adapters, where GeoGebra's restricted branch
  hides the menu bar, tool bar, file features and CAS but keeps the input, and Cortex
  disables the clipboard.
  
  `expressions` leaves the restricted set. The rest of it does not change, and
  neither does its precedence: restricted mode still lands after the host's own
  `settings` and a host still cannot relax it, which is the contract Cortex states
  for the same flag. A host that does want the list gone passes
  `settings: { expressions: false }` and sets the chrome flags itself — those are
  honoured wherever restricted mode is not what overrides them.
  
  A host currently sending `restrictedMode: true` for a graphing Desmos calculator
  will see the expression list appear. That is the fix, not a regression: the panel
  it replaces could not be used for anything. No host in the consumer dependency pad
  sends the field.
- 3544e9d: Move Desmos per-instance configuration to the Desmos adapter package, and align the calculator contract with the TTS one. `@pie-players/pie-calculator` no longer exports the Desmos settings type or accepts `desmos` on `CalculatorProviderConfig`; import `DesmosCalculatorSettings` and `DesmosCalculatorProviderConfig` from `@pie-players/pie-calculator-desmos` instead.
  
  `CalculatorProvider` and `Calculator` stay un-parameterized, matching `ITTSProvider` in `@pie-players/pie-tts`. An adapter extends `CalculatorProviderConfig` and narrows `createCalculator`'s argument in its own class signature, which is what gives a caller holding the concrete provider the precise type; a type parameter on the interface would add nothing, since a provider narrowing that argument satisfies it either way. `CalculatorProvider.initialize` now takes an optional `CalculatorProviderInit` — vendor credentials and an instrumentation callback — so a provider that authenticates is describable by the contract rather than by a structural mirror. `DesmosToolProvider` is typed by `CalculatorProvider` from the contract package, the way `TTSToolProvider` is typed by `ITTSProvider`, and reaches `@pie-players/pie-calculator-desmos` only inside a method body: that package is an optional peer, and a top-level type import from it would reach the toolkit's published declarations and make the optional peer required for anyone type-checking without `skipLibCheck`.
  
  The runtime shape is `{ restrictedMode, settings: { … } }`, one vendor-neutral field for every adapter, so an adapter can own typed configuration without leaking provider knowledge into the generic package. The consumer dependency pad records no documented host importing any calculator type, so the listed hosts are unaffected.
- cb99eae: Delete the Desmos adapter's deprecated configuration surface: the `apiKey` and
  `proxyEndpoint` fields on its settings type, and the
  `DesmosCalculatorProviderConfig.desmos` option bag that held them. Vendor options
  are `settings`, the same field every adapter uses, and credentials are
  provider-level -- `initialize()`, typed by `CalculatorProviderInit`, which is
  untouched and still the canonical production path.
  
  Verified against all three consumer checkouts on 2026-08-27 before removing:
  neither host that offers Desmos passes a config bag at all. Both configure it
  through `provider.runtime.authFetcher` alone, nothing names
  the settings type or `DesmosCalculatorProviderConfig`, and nothing sets a
  credential in a config bag. Three source breaks with no source to break; the
  consumer dependency pad records the check.
  
  Nothing changed about what reaches Desmos. The credentials were already inert in
  a per-instance bag -- deleted before the vendor constructor, since Desmos rejects
  an unknown option and a key there has no effect -- and `settings` already won
  whenever both forms were present, so the merge that consulted the bag could only
  supply keys `settings` had omitted. The stripping stays and is now one helper
  rather than four `delete` statements; because the settings type keeps its
  index signature, `settings` still accepts both credential names from a stale
  caller and still drops them.
  
  `DesmosCalculatorProviderConfig` is now `CalculatorProviderConfig` with `settings`
  narrowed to the settings type, which is what makes the removal an
  improvement rather than a subtraction: a client on the canonical field previously
  traded every Desmos option name for `Record<string, unknown>`, so the deprecated
  bag was the only typed way to configure the calculator. The narrowing is
  assignment-compatible in both directions with a plain `Record<string, unknown>`.
  
  Two pending changesets and one ADR promised the option bag or named it in a
  trade-off; all three now describe `settings`. The calculators README also read as
  though `proxyEndpoint` were deprecated alongside it.
- Updated dependencies [cb99eae]
- Updated dependencies [8bb668b]
- Updated dependencies [3544e9d]
  - @pie-players/pie-calculator@0.3.69

## 0.3.68

### Patch Changes

- @pie-players/pie-calculator@0.3.68

## 0.3.67

### Patch Changes

- @pie-players/pie-calculator@0.3.67

## 0.3.66

### Patch Changes

- @pie-players/pie-calculator@0.3.66

## 0.3.65

### Patch Changes

- @pie-players/pie-calculator@0.3.65

## 0.3.64

### Patch Changes

- @pie-players/pie-calculator@0.3.64

## 0.3.63

### Patch Changes

- @pie-players/pie-calculator@0.3.63

## 0.3.62

### Patch Changes

- 3b4e461: Keep every runtime dependency external in the assessment toolkit's custom-element build, and stop publishing sourcemaps.

  Inlining a dependency into a prebuilt custom-element chunk creates a copy a consumer's bundler cannot deduplicate, because its module id is the chunk file rather than the dependency's path in `node_modules`. `speech-rule-engine` was reaching the section player twice for exactly that reason — once through `services/tts/math-speech.js` and once inside the prebuilt chunk — about 1.3 MB of duplicate payload. Externalizing the manifest's dependencies collapses that to one copy. It asks nothing new of consumers: these artifacts already emitted bare `@pie-players/*` specifiers, so they always required a bundler or an import map.

  Publishable packages ship only `dist`, so a usable sourcemap also required `inlineSources`, which embedded every TypeScript source into the tarball. That cost roughly 2.5 MB across the tsc-built packages while every Vite-built package in the repo already shipped none. Sourcemaps are now off everywhere.

- Updated dependencies [3b4e461]
  - @pie-players/pie-calculator@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-calculator@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-calculator@0.3.60

## 0.3.59

### Patch Changes

- @pie-players/pie-calculator@0.3.59

## 0.3.58

### Patch Changes

- @pie-players/pie-calculator@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.56

## 0.3.55

### Patch Changes

- @pie-players/pie-calculator@0.3.55

## 0.3.54

### Patch Changes

- @pie-players/pie-calculator@0.3.54

## 0.3.53

### Patch Changes

- @pie-players/pie-calculator@0.3.53

## 0.3.52

### Patch Changes

- @pie-players/pie-calculator@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.45

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.44

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.40

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.39

## 0.3.38

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.38

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.37

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.36

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.35

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.34

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.33

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.32

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.31

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.18

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.17

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.16

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.15

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.14

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.13

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.12

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.11

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.9

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.9

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.8

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.7

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.6

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.5

## 0.3.4

### Patch Changes

- @pie-players/pie-calculator@0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.3

## 0.3.2

### Patch Changes

- @pie-players/pie-calculator@0.3.2

## 0.3.1

### Patch Changes

- @pie-players/pie-calculator@0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

- Updated dependencies
- Updated dependencies [9385ce0]
  - @pie-players/pie-calculator@0.3.0

## 0.1.6

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/pie-calculator@0.1.5

## 0.1.5

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
- Updated dependencies [71a9581]
  - @pie-players/pie-calculator@0.1.4
