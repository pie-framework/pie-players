# @pie-players/pie-tool-dictionary

## 0.3.75

### Patch Changes

- c6b509c: Each section-player input has one tier: `nds-icons`, `locale` and `tool-config-strictness` are layout attributes only, and `assessmentId`, `onFrameworkError`, `onStageChange`, `onLoadingComplete` and tool config are `runtime` keys only, so a host that sets `assessment-id` or a callback property on a layout element moves it into `runtime`. The toolkit's `pnp-enforcement` attribute is gone; set `tools.pnpEnforcement`. Layout elements drop `selectComposition`, `selectNavigation`, `selectReadiness` and the readiness-phase types; read `getSnapshot()` and listen for `pie-stage-change`. The section player's entries are the root, `./browser`, the splitpane component subpath, `./contracts/runtime-host-contract`, `./contracts/host-hooks`, `./policies` and `./item-section`; a host importing another component subpath imports the root. The layout-contract constants, `SECTION_PLAYER_PUBLIC_EVENTS`, `isPreloadEnabled` and `isTelemetryEnabled` are removed; read `resolveSectionPlayerPolicies(policies)`. The toolkit's `./runtime/engine` no longer exports `createReadinessDetail`, `resolveOnFrameworkError`, `DEFAULT_ASSESSMENT_ID` or `EffectiveRuntime`.
  
  `ToolkitCoordinatorApi` drops `getServiceBundle`, `getInitStatus`, `isToolEnabled`, `registerToolContextResolver` and `setToolContextResolvers`, and the toolkit element drops `getServiceBundle()`; read the coordinator's service properties, `isReady()` and `getToolConfig()`, and pass resolvers as `runtime.toolContextResolvers`. A host-supplied coordinator must implement `onReadyChange`. `ToolkitInitStatus` and `ToolkitServiceBundle` are removed. `createEmptyPersonalNeedsProfile` moves to `@pie-players/pie-default-tool-loaders`, which drops `registerPackagedTools`, `registerDefaultToolModuleLoaders`, `PACKAGED_TOOL_ORDER`, `PACKAGED_TOOL_PLACEMENT`, `UNIVERSAL_SUPPORTS_PRESET` and the re-exported `ToolModuleLoader`. The policy source-tag types, `ToolPolicyEntry.sources` and `ToolPolicyDiagnostic.source` are removed; a decision's `rule` and a diagnostic's `details` carry attribution, and `"tts"` is no longer special-cased as a tool id. A profile's `prohibitedSupports` now outranks item and district requirements, so PNP precedence is one order: district block, `false` override, item restriction, prohibition, `true` override, item requirement, district requirement, profile support. `stimulusRefs` is removed from the shared types, and `toolConfigs` and `toolParameters` are object-valued records. `@pie-players/pie-tool-calculator-shared` drops its root entry; import `/calculator-element`. The PNP debugger and TTS settings panels dispatch `close` from the host element, without bubbling.
  
  Text-to-speech names a server provider one way: `backend: "server"` with `serverProvider: "polly" | "google" | "custom"`, so a host setting `backend: "polly"` or `"google"` moves the name to `serverProvider`, and a string `provider` is rejected. Keys nested under `settings` are no longer read; move them, `mathSpeech` included, to the top level. `TextToSpeechToolProviderConfig` is closed and exported in place of `ToolConfig` and `TTSToolConfig`. `TTSFeature` and `ITTSProvider.supportsFeature` are removed; a custom provider deletes the method. `DEFAULT_TTS_SPEED_OPTIONS`, `normalizeTTSSpeedOptions`, `resolveRuntimeProvider`, `resolveTTSBackend`, `resolveTransportMode` and `BrowserVoiceTraits` leave `./tools/registration`. `TtsServiceApi.onStateChange(callback)` returns its unsubscribe function and `offStateChange` is removed, and `bindTtsAudioHandoff` drops `listenerId`. A custom highlight coordinator implements `highlightTTSWordElement` and `highlightTTSSentenceElements`; `clearAll` leaves the interface. `TTSService.initialize` rejects when its provider fails to start, and the coordinator owns the browser fallback, reported as `pie-tool-init-fallback`. `<pie-tool-tts-inline>` defaults `layoutMode` to `left-aligned`, and reads `--pie-button-border` and `--pie-button-hover-bg` in place of `--pie-button-border-color` and `--pie-button-hover-background-color`. The annotation toolbar offers read-aloud only when a toolbar hosts `textToSpeech`. `--pie-background-light` leaves the theme token registry, the assessment player's navigation reads `--pie-background` in its place, and the dictionary and picture-dictionary panels read `--pie-secondary-background`. `PieThemeTokenScope` drops `"unsupported"` and `PieThemeTokenStatus` drops `"intentional-gap"`, which no entry uses.
- Updated dependencies [7cf309e]
- Updated dependencies [7400511]
- Updated dependencies [14e53c9]
- Updated dependencies [53940c9]
- Updated dependencies [6b26e88]
- Updated dependencies [f5465e5]
- Updated dependencies [8edca42]
- Updated dependencies [c6b509c]
- Updated dependencies [1025fba]
- Updated dependencies [296055c]
- Updated dependencies [6f57b31]
- Updated dependencies [ad05203]
- Updated dependencies [4e9913f]
- Updated dependencies [cdc3dd7]
- Updated dependencies [dcc7375]
- Updated dependencies [78491f2]
- Updated dependencies [7aeddb9]
- Updated dependencies [3ac0028]
- Updated dependencies [d7c46ac]
- Updated dependencies [1ec8e34]
- Updated dependencies [8122e1e]
- Updated dependencies [bcba901]
- Updated dependencies [d9f56e8]
- Updated dependencies [55d97fd]
  - @pie-players/pie-players-shared@0.3.75

## 0.3.74

### Patch Changes

- 8b24361: Boolean attributes on the custom elements read `"false"`, `"0"`, `"off"` and
  `"no"` as false instead of treating any present value as true, so
  `trust-markup="false"` no longer skips sanitization.
- 25fd8d8: Loading a second copy of a player or tool into a page that already registered
  its custom elements no longer throws. The copy that registered a tag first keeps
  rendering it, the rule `pie-item-player` and the toolkit's elements already
  follow.
- 8e13d3d: Scoped CSS class names, and the identifiers the minifier derives alongside
  them, are the same whichever checkout builds the package.
- Updated dependencies [30a037f]
- Updated dependencies [8b24361]
- Updated dependencies [8b24361]
- Updated dependencies [377146f]
- Updated dependencies [5fb7902]
- Updated dependencies [3cb91c5]
- Updated dependencies [3ccab31]
- Updated dependencies [b072a44]
- Updated dependencies [0e8e8df]
- Updated dependencies [223f00a]
- Updated dependencies [05845a3]
- Updated dependencies [adc3da6]
- Updated dependencies [e40a2a6]
- Updated dependencies [39b2c16]
- Updated dependencies [dba059f]
- Updated dependencies [7d99003]
- Updated dependencies [580cc7b]
- Updated dependencies [0d36cde]
- Updated dependencies [a4f73f6]
- Updated dependencies [aa58883]
- Updated dependencies [6859fb7]
- Updated dependencies [fa3ade0]
- Updated dependencies [a0408d4]
- Updated dependencies [f5d1b01]
- Updated dependencies [63b75e6]
- Updated dependencies [549de08]
- Updated dependencies [d860667]
- Updated dependencies [3841938]
- Updated dependencies [9d51813]
- Updated dependencies [2bbda17]
- Updated dependencies [05b698f]
- Updated dependencies [cadfcf9]
- Updated dependencies [a2a97eb]
- Updated dependencies [2be7868]
- Updated dependencies [cd183fa]
- Updated dependencies [a38056b]
- Updated dependencies [140d39b]
- Updated dependencies [da9e2f7]
- Updated dependencies [fbb61b6]
- Updated dependencies [da37ba4]
- Updated dependencies [771def2]
- Updated dependencies [8a8b932]
- Updated dependencies [ec632eb]
- Updated dependencies [ff7c2bc]
- Updated dependencies [5a0bcb1]
- Updated dependencies [22bcd83]
  - @pie-players/pie-players-shared@0.3.74

## 0.3.73

### Patch Changes

- Updated dependencies [e2fd6b8]
- Updated dependencies [83d30e3]
  - @pie-players/pie-players-shared@0.3.73

## 0.3.72

### Patch Changes

- @pie-players/pie-players-shared@0.3.72

## 0.3.71

### Patch Changes

- Updated dependencies [69f354e]
- Updated dependencies [6c089fd]
- Updated dependencies [ee795c8]
  - @pie-players/pie-players-shared@0.3.71

## 0.3.70

### Patch Changes

- Updated dependencies [e8ab025]
- Updated dependencies [9868ee1]
- Updated dependencies [e3169f8]
- Updated dependencies [b544a28]
- Updated dependencies [8b4e0e4]
- Updated dependencies [ab1b1a9]
- Updated dependencies [f10fa7d]
- Updated dependencies [3d6acc6]
- Updated dependencies [47ae660]
- Updated dependencies [c9267e5]
- Updated dependencies [da5b9da]
  - @pie-players/pie-players-shared@0.3.70

## 0.3.69

### Patch Changes

- e66efff: Make each tool package's root type entry describe what its root runtime entry actually provides. `insertTypesEntry` derives that entry from the bundle entry — a `.svelte` component — and overwrites the `index.d.ts` emitted from `index.ts`, so any package whose bundle entry is a component published a root entry that ignored its own `index.ts`.
  
  Where `index.ts` re-exported *types*, they now ship: `@pie-players/pie-tool-dictionary` exports `DictionaryEntry`, `DictionaryLookup`, `DictionaryLookupRequest`, `DictionaryLookupResult` and `DictionarySense`; `@pie-players/pie-tool-picture-dictionary` exports `PictureLookup`, `PictureLookupRequest`, `PictureLookupResult` and `PictureResult`; `@pie-players/pie-tool-calculator-desmos` exports `CalculatorType`. Additive — no name changed, and nothing could import these before because they were never in a published tarball. A host supplying a dictionary or picture-dictionary endpoint can now type its response against the shape the tool reads, instead of declaring that shape itself.
  
  Where `index.ts` re-exported a *value*, the re-export was removed instead. `@pie-players/pie-tool-answer-eliminator` re-exported `AdapterRegistry` from its root, but the root runtime entry is the built bundle, which exports the component and nothing named — so shipping that type export would have type-checked and then been `undefined` at run time. `AdapterRegistry` is reached through the `./adapters/adapter-registry` subpath, which its README now shows.
- @pie-players/pie-players-shared@0.3.69

## 0.3.68

### Patch Changes

- d68c01b: Add dictionary and picture dictionary tools, and make the shell's focus trap
  shadow-aware so a hosted tool's own controls are reachable by keyboard.
  
  `pie-tool-dictionary` and `pie-tool-picture-dictionary` are floating panels opened from
  the toolbar, each with a term field and a results area. Neither ships an endpoint: the
  corpus behind a dictionary is licensed per programme, so a host supplies one through
  `endpoint` for the built-in POST shaping, or assigns the element's `lookup` property to
  use its own client. With neither, the panel says no service is configured rather than
  offering a field that fails silently.
  
  Neither declares a universal support id. A dictionary is a granted accommodation, and on
  a vocabulary item it is construct-relevant, so handing it to every learner by default
  would change what the item measures.
  
  Both accept a `term` from whatever selection affordance a host offers, and neither
  depends on one. A sighted keyboard-only learner cannot originate a text selection in
  non-editable content — Chromium does not extend one with Shift+Arrow there without caret
  browsing, an OS toggle absent on mobile — so a selection-only dictionary is unreachable
  for them. The panel's field is the keyboard route, which is why it exists.
  
  That route did not work until the focus trap was fixed. `createFocusTrap` collected
  focusables with `querySelectorAll`, which stops at a shadow boundary; every tool in this
  repo renders into `shadow: "open"`, so the trap saw only the shell's own chrome. Tab
  cycled those nine controls and the hosted tool's content was unreachable by keyboard
  entirely — for the calculator, graph, periodic table and theme panels as much as for
  these two. Collection now descends into open shadow roots, and skips `tabindex="-1"`,
  which belongs to programmatic focus rather than the tab order.
  
  A lookup distinguishes "no entry for this word" from "the service did not answer",
  because collapsing them tells a learner their word is not real when the network is down.
  A term longer than four words is refused without a request. Picture URLs that are not
  `https:`, protocol-relative, or same-origin are dropped rather than rendered, and a
  picture's caption becomes its `alt` — the picture is the definition, so it is never
  decorative.
  
  Covered by unit tests over the lookup and focus-collection logic, and by
  `packages/section-player/tests/section-dictionary-tools.spec.ts`, which drives the tool
  from the keyboard alone in a browser.
- 1d9f2d3: One term-lookup implementation behind both dictionaries, and three defaults that no longer need a host to know about them.
  
  The two dictionaries shipped as near-copies: term normalisation and the headword guard were character-identical, the POST clients differed only in error strings, and each panel carried its own copy of the same state machine. That is now one module, `@pie-players/pie-players-shared/tools/term-lookup`, and each tool supplies only what a result of its own carries — an entry, or a picture. The subtle part, a superseded lookup not overwriting the newer one's state, exists once and is tested once. A lookup result is `{ status, items }` rather than `entries`/`pictures`.
  
  **An endpoint alone is now the whole configuration.** The client sent `credentials: "omit"` and documented `headers` as the way to authorise, but `headers` was unreachable: the element exposed no such property and the factory taking it was never exported. A host that put its dictionary route behind the assessment's own session — which the tool host contract asks for — got a 401 on every lookup and a learner-facing "the dictionary is unavailable (401)". Endpoints are called `same-origin`, so that route answers with nothing further configured; `headers` and `credentials` are now real properties for a host authorising some other way, and neither is required.
  
  **Plain `http:` picture URLs are refused.** The validator accepted `https?:` while its own comment said anything else with a scheme was refused, so `http://cdn.example/cat.png` reached `src` and was mixed-content-blocked on every https deployment — the broken image the guard exists to prevent. Protocol-relative and same-origin paths still pass, and "same-origin" is now checked by resolving rather than by looking for a leading slash: `/\evil.example/x.png` looks like a path and resolves to another host, because a backslash is a path separator for special schemes and a tab is stripped outright. Both still resolve to https, so neither defeated the mixed-content guard — but same-origin is what the function claims.
  
  **A requested term is answered once per request, not once per term.** Params reach a tool through a seam reapplied on every sync, so the term alone cannot distinguish a re-render from a fresh ask. Keyed on the panel's last search, every reopen re-issued the selection that opened it and discarded the word the learner had typed since. Requests now carry a `termRequestId`, which both dictionary panels accept as an optional property; a host assigning `term` directly can leave it unset and gets term identity, enough to stop a re-render re-issuing.
  
  **A tool-open request falls back off section scope.** Requests defaulted to `"section"` and resolved only there, so a host placing a capability at item scope only had the selection action silently vanish: the tool was granted, hosted and visible, with no action on the selection and nothing to say why. Resolution now prefers section scope and falls back to any level that hosts the capability. Naming a level in the request still makes it a constraint, honoured strictly.
  
  Both panels' effects now write their reactive state under `untrack`, matching the rule AGENTS.md sets for effect bodies that read what they write. `check:capability-neutrality` gained `dictionary` and `pictureDictionary`, so its guard covers the packaged set its own comment claims to track.
  
  Also: `requestTool`, `canRequestTool`, `registerToolRequestTarget` and `onToolRequestTargetsChange` are optional on `ToolkitCoordinatorApi`. They were declared required while both call sites duck-typed them away for a host coordinator predating the seam, which made such a coordinator structurally non-conformant for no benefit. Both dictionary packages dropped two declared dependencies that nothing imported.
- Updated dependencies [2d8ce6a]
- Updated dependencies [27284f8]
- Updated dependencies [d68c01b]
- Updated dependencies [3f5e968]
- Updated dependencies [67f286c]
- Updated dependencies [55016b5]
- Updated dependencies [fc71c91]
- Updated dependencies [00b8a71]
- Updated dependencies [6e1e053]
- Updated dependencies [e94b097]
- Updated dependencies [7c9fb28]
- Updated dependencies [979e643]
- Updated dependencies [1d9f2d3]
- Updated dependencies [54742db]
- Updated dependencies [cb11691]
  - @pie-players/pie-players-shared@0.3.68
