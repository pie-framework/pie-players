# @pie-players/pie-tts

## 0.3.75

### Patch Changes

- c6b509c: Each section-player input has one tier: `nds-icons`, `locale` and `tool-config-strictness` are layout attributes only, and `assessmentId`, `onFrameworkError`, `onStageChange`, `onLoadingComplete` and tool config are `runtime` keys only, so a host that sets `assessment-id` or a callback property on a layout element moves it into `runtime`. The toolkit's `pnp-enforcement` attribute is gone; set `tools.pnpEnforcement`. Layout elements drop `selectComposition`, `selectNavigation`, `selectReadiness` and the readiness-phase types; read `getSnapshot()` and listen for `pie-stage-change`. The section player's entries are the root, `./browser`, the splitpane component subpath, `./contracts/runtime-host-contract`, `./contracts/host-hooks`, `./policies` and `./item-section`; a host importing another component subpath imports the root. The layout-contract constants, `SECTION_PLAYER_PUBLIC_EVENTS`, `isPreloadEnabled` and `isTelemetryEnabled` are removed; read `resolveSectionPlayerPolicies(policies)`. The toolkit's `./runtime/engine` no longer exports `createReadinessDetail`, `resolveOnFrameworkError`, `DEFAULT_ASSESSMENT_ID` or `EffectiveRuntime`.
  
  `ToolkitCoordinatorApi` drops `getServiceBundle`, `getInitStatus`, `isToolEnabled`, `registerToolContextResolver` and `setToolContextResolvers`, and the toolkit element drops `getServiceBundle()`; read the coordinator's service properties, `isReady()` and `getToolConfig()`, and pass resolvers as `runtime.toolContextResolvers`. A host-supplied coordinator must implement `onReadyChange`. `ToolkitInitStatus` and `ToolkitServiceBundle` are removed. `createEmptyPersonalNeedsProfile` moves to `@pie-players/pie-default-tool-loaders`, which drops `registerPackagedTools`, `registerDefaultToolModuleLoaders`, `PACKAGED_TOOL_ORDER`, `PACKAGED_TOOL_PLACEMENT`, `UNIVERSAL_SUPPORTS_PRESET` and the re-exported `ToolModuleLoader`. The policy source-tag types, `ToolPolicyEntry.sources` and `ToolPolicyDiagnostic.source` are removed; a decision's `rule` and a diagnostic's `details` carry attribution, and `"tts"` is no longer special-cased as a tool id. A profile's `prohibitedSupports` now outranks item and district requirements, so PNP precedence is one order: district block, `false` override, item restriction, prohibition, `true` override, item requirement, district requirement, profile support. `stimulusRefs` is removed from the shared types, and `toolConfigs` and `toolParameters` are object-valued records. `@pie-players/pie-tool-calculator-shared` drops its root entry; import `/calculator-element`. The PNP debugger and TTS settings panels dispatch `close` from the host element, without bubbling.
  
  Text-to-speech names a server provider one way: `backend: "server"` with `serverProvider: "polly" | "google" | "custom"`, so a host setting `backend: "polly"` or `"google"` moves the name to `serverProvider`, and a string `provider` is rejected. Keys nested under `settings` are no longer read; move them, `mathSpeech` included, to the top level. `TextToSpeechToolProviderConfig` is closed and exported in place of `ToolConfig` and `TTSToolConfig`. `TTSFeature` and `ITTSProvider.supportsFeature` are removed; a custom provider deletes the method. `DEFAULT_TTS_SPEED_OPTIONS`, `normalizeTTSSpeedOptions`, `resolveRuntimeProvider`, `resolveTTSBackend`, `resolveTransportMode` and `BrowserVoiceTraits` leave `./tools/registration`. `TtsServiceApi.onStateChange(callback)` returns its unsubscribe function and `offStateChange` is removed, and `bindTtsAudioHandoff` drops `listenerId`. A custom highlight coordinator implements `highlightTTSWordElement` and `highlightTTSSentenceElements`; `clearAll` leaves the interface. `TTSService.initialize` rejects when its provider fails to start, and the coordinator owns the browser fallback, reported as `pie-tool-init-fallback`. `<pie-tool-tts-inline>` defaults `layoutMode` to `left-aligned`, and reads `--pie-button-border` and `--pie-button-hover-bg` in place of `--pie-button-border-color` and `--pie-button-hover-background-color`. The annotation toolbar offers read-aloud only when a toolbar hosts `textToSpeech`. `--pie-background-light` leaves the theme token registry, the assessment player's navigation reads `--pie-background` in its place, and the dictionary and picture-dictionary panels read `--pie-secondary-background`. `PieThemeTokenScope` drops `"unsupported"` and `PieThemeTokenStatus` drops `"intentional-gap"`, which no entry uses.
- 6ee4cb8: Remove surfaces nothing reads. `ReadinessPolicyAdapter` is no longer exported from `@pie-players/pie-section-player`; a host that imported the type gets a compile error. `TTSConfigExtensions.organizationId` and `region` are gone from `@pie-players/pie-tts`; a config literal that sets them no longer type-checks. The TTS inline control no longer receives a `tool-id` attribute, which it never read. `@pie-players/pie-assessment-toolkit/tools/registration` exports `waitForBrowserVoices`, and with a configured voice, the browser TTS provider now waits for the voice inventory once, during initialization, up to two seconds.
- 3ac0028: `ToolProviderApi` takes no config type parameter: it is `ToolProviderApi<TInstance>`, and an implementation narrows its config in its own method signatures. `pie-loading-complete` no longer carries `loadedCount`, which always equalled `itemCount`. The browser TTS provider reports `supportsWordBoundary: true`, since it forwards the boundaries its voice sends, and keeps sentence highlighting as its default through the new `TTSProviderCapabilities.defaultHighlightMode`.
- cf199c9: Read-aloud has one entry: `ttsService.speak(target, options)` reads a DOM range or element, with spoken cards, math speech and `data-tts-suppress` applied the same way on every path. `speak(text)` and `speakRange` are removed; a caller passes the element or range it read. `TTSService.dispose()` is added, and the coordinator's dispose calls it.
  
  A new speak stops a recorded clip still playing, a pause between two parts of a read holds the next part, and a superseded server read no longer logs an error. The server provider sends the language a read names, except that a host's `lang_id` wins on the custom transport, and text over a provider's `maxTextLength` is read in pieces. A toolbar read names a language only when the toolbar's `language` or the host's `content-language` does, and `ToolbarContext.language` is otherwise absent. Two toolkits on one page share the page's highlights, and a theme change keeps the read-aloud colors adapted to the content.
- d9f56e8: The toolkit root exports 185 names instead of 326: the names only tool packages use moved to `./tools/registration`, and the names nothing imports are removed, among them the backend activity-session adapters, the item loader and the session-storage helpers. The TypeScript examples in the READMEs match the current API.
- 55d97fd: A pause or stop issued while a read loads holds, media started during loading pauses the read, and a word spanning several text nodes highlights whole. `ITTSProviderImplementation.updateSettings` is required and `HighlightCoordinator.highlightTTSWord` takes the word's ranges; the TTS settings panel picks browser voices for the content language, `TTSToolProvider` reports its speech provider's features, a failed speech-rule-engine load is retried on the next read and warned about once, server TTS telemetry names the tool `textToSpeech`, and read-aloud's debug lines log only under `PIE_TTS_DEBUG`.

## 0.3.74

No changes in this release.

## 0.3.73

No changes in this release.

## 0.3.72

## 0.3.71

## 0.3.70

## 0.3.69

## 0.3.68

## 0.3.67

## 0.3.66

### Patch Changes

- 556c422: Make Browser API playback reliable by coalescing and serializing rate updates,
  publishing playback state and sentence highlighting from the provider's real
  start event, and rejecting native speech that ends or stalls before starting.
  Keep Chrome's native default voice unassigned while assigning explicitly chosen
  non-default voices. Browser voice identifiers accept an exact voice URI or
  documented name, while newly applied selections persist the unique URI. Server
  fallbacks now carry only portable rate, pitch, and highlighting settings into
  the Browser provider instead of leaking a server-specific voice. Ignore CSS-wide
  custom-element reset declarations when checking for a duplicate PIE content
  stylesheet.

## 0.3.65

## 0.3.64

## 0.3.63

## 0.3.62

### Patch Changes

- 3b4e461: Keep every runtime dependency external in the assessment toolkit's custom-element build, and stop publishing sourcemaps.

  Inlining a dependency into a prebuilt custom-element chunk creates a copy a consumer's bundler cannot deduplicate, because its module id is the chunk file rather than the dependency's path in `node_modules`. `speech-rule-engine` was reaching the section player twice for exactly that reason — once through `services/tts/math-speech.js` and once inside the prebuilt chunk — about 1.3 MB of duplicate payload. Externalizing the manifest's dependencies collapses that to one copy. It asks nothing new of consumers: these artifacts already emitted bare `@pie-players/*` specifiers, so they always required a bundler or an import map.

  Publishable packages ship only `dist`, so a usable sourcemap also required `inlineSources`, which embedded every TypeScript source into the tarball. That cost roughly 2.5 MB across the tsc-built packages while every Vite-built package in the repo already shipped none. Sourcemaps are now off everywhere.

## 0.3.61

## 0.3.60

## 0.3.59

## 0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.55

## 0.3.54

## 0.3.53

## 0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- fd140a3: TTS: generate spoken math as SSML for SSML-capable providers (PIE-623)

  The generated (no authored `accessibilityCatalogs`) math speech path can now
  emit Speech Rule Engine SSML to providers that voice it, while keeping the same
  confidence-gated highlighting and plain-text behavior everywhere else.

  - `@pie-players/pie-tts`: `TTSProviderCapabilities` gains an optional
    `supportsSSML` flag. It is optional and defaults to `false`, so existing
    provider implementations are unaffected.
  - `@pie-players/tts-client-server`: `ServerTTSProvider.getCapabilities()` now
    reports `supportsSSML`. It is conservative — `true` only for the SSML-reliable
    `pie` transport backends (Polly, Google) and `false` for the `custom`
    transport and unknown providers.
  - `@pie-players/pie-assessment-toolkit`: the speech composition core assembles a
    DOM-free plan and, for SSML-capable providers, sends SRE SSML for math
    segments with a plain-text speak-time fallback if a provider rejects it. The
    browser Web Speech provider always receives plain text.
  - `@pie-players/pie-assessment-toolkit`: fixed word/token-level highlighting for
    generated math SSML. Provider word boundaries on a generated math chunk (raw
    SSML in `speechText`, no catalog span alignment) are now mapped from
    raw-SSML offsets back into spoken-text space, so per-token tracking works the
    same as the authored-SSML path instead of falling back to whole-formula
    block highlighting.
  - `@pie-players/pie-assessment-toolkit`: strip the leading `<?xml …?>` prolog
    from Speech Rule Engine SSML so SSML-capable providers (AWS Polly, Google),
    which require the payload to begin with `<speak>`, accept the generated math
    SSML.

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.38

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.

## 0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.

## 0.3.2

## 0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

## 0.1.5

### Patch Changes

- beffcc0: Release all publishable packages.

## 0.1.4

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
