# @pie-players/pie-section-player-tools-tts-settings

## 0.3.75

### Patch Changes

- c6b509c: Each section-player input has one tier: `nds-icons`, `locale` and `tool-config-strictness` are layout attributes only, and `assessmentId`, `onFrameworkError`, `onStageChange`, `onLoadingComplete` and tool config are `runtime` keys only, so a host that sets `assessment-id` or a callback property on a layout element moves it into `runtime`. The toolkit's `pnp-enforcement` attribute is gone; set `tools.pnpEnforcement`. Layout elements drop `selectComposition`, `selectNavigation`, `selectReadiness` and the readiness-phase types; read `getSnapshot()` and listen for `pie-stage-change`. The section player's entries are the root, `./browser`, the splitpane component subpath, `./contracts/runtime-host-contract`, `./contracts/host-hooks`, `./policies` and `./item-section`; a host importing another component subpath imports the root. The layout-contract constants, `SECTION_PLAYER_PUBLIC_EVENTS`, `isPreloadEnabled` and `isTelemetryEnabled` are removed; read `resolveSectionPlayerPolicies(policies)`. The toolkit's `./runtime/engine` no longer exports `createReadinessDetail`, `resolveOnFrameworkError`, `DEFAULT_ASSESSMENT_ID` or `EffectiveRuntime`.
  
  `ToolkitCoordinatorApi` drops `getServiceBundle`, `getInitStatus`, `isToolEnabled`, `registerToolContextResolver` and `setToolContextResolvers`, and the toolkit element drops `getServiceBundle()`; read the coordinator's service properties, `isReady()` and `getToolConfig()`, and pass resolvers as `runtime.toolContextResolvers`. A host-supplied coordinator must implement `onReadyChange`. `ToolkitInitStatus` and `ToolkitServiceBundle` are removed. `createEmptyPersonalNeedsProfile` moves to `@pie-players/pie-default-tool-loaders`, which drops `registerPackagedTools`, `registerDefaultToolModuleLoaders`, `PACKAGED_TOOL_ORDER`, `PACKAGED_TOOL_PLACEMENT`, `UNIVERSAL_SUPPORTS_PRESET` and the re-exported `ToolModuleLoader`. The policy source-tag types, `ToolPolicyEntry.sources` and `ToolPolicyDiagnostic.source` are removed; a decision's `rule` and a diagnostic's `details` carry attribution, and `"tts"` is no longer special-cased as a tool id. A profile's `prohibitedSupports` now outranks item and district requirements, so PNP precedence is one order: district block, `false` override, item restriction, prohibition, `true` override, item requirement, district requirement, profile support. `stimulusRefs` is removed from the shared types, and `toolConfigs` and `toolParameters` are object-valued records. `@pie-players/pie-tool-calculator-shared` drops its root entry; import `/calculator-element`. The PNP debugger and TTS settings panels dispatch `close` from the host element, without bubbling.
  
  Text-to-speech names a server provider one way: `backend: "server"` with `serverProvider: "polly" | "google" | "custom"`, so a host setting `backend: "polly"` or `"google"` moves the name to `serverProvider`, and a string `provider` is rejected. Keys nested under `settings` are no longer read; move them, `mathSpeech` included, to the top level. `TextToSpeechToolProviderConfig` is closed and exported in place of `ToolConfig` and `TTSToolConfig`. `TTSFeature` and `ITTSProvider.supportsFeature` are removed; a custom provider deletes the method. `DEFAULT_TTS_SPEED_OPTIONS`, `normalizeTTSSpeedOptions`, `resolveRuntimeProvider`, `resolveTTSBackend`, `resolveTransportMode` and `BrowserVoiceTraits` leave `./tools/registration`. `TtsServiceApi.onStateChange(callback)` returns its unsubscribe function and `offStateChange` is removed, and `bindTtsAudioHandoff` drops `listenerId`. A custom highlight coordinator implements `highlightTTSWordElement` and `highlightTTSSentenceElements`; `clearAll` leaves the interface. `TTSService.initialize` rejects when its provider fails to start, and the coordinator owns the browser fallback, reported as `pie-tool-init-fallback`. `<pie-tool-tts-inline>` defaults `layoutMode` to `left-aligned`, and reads `--pie-button-border` and `--pie-button-hover-bg` in place of `--pie-button-border-color` and `--pie-button-hover-background-color`. The annotation toolbar offers read-aloud only when a toolbar hosts `textToSpeech`. `--pie-background-light` leaves the theme token registry, the assessment player's navigation reads `--pie-background` in its place, and the dictionary and picture-dictionary panels read `--pie-secondary-background`. `PieThemeTokenScope` drops `"unsupported"` and `PieThemeTokenStatus` drops `"intentional-gap"`, which no entry uses.
- d9f56e8: The toolkit root exports 185 names instead of 326: the names only tool packages use moved to `./tools/registration`, and the names nothing imports are removed, among them the backend activity-session adapters, the item loader and the session-storage helpers. The TypeScript examples in the READMEs match the current API.
- fbd4570: `TTSService.speak` resolves a read's language once for every entry point, a pinned `lang_id` stands in as the content language where markup and the tool name none, and a read without a language restores the host's locales. The Polly and Google servers pick a voice for the request's `language` when none is named, and the toolkit no longer names a default voice for them. A seek while paused moves the cursor and stays paused. The TTS settings panel's applies replace the previous backend's fields, and its browser preview reads through a `TTSService` of its own, so the panel now depends on `speech-rule-engine`. A browser fallback no longer destroys a registry-owned provider, server audio reports start on `playing`, and a superseded audio element's error is ignored.
- 55d97fd: A pause or stop issued while a read loads holds, media started during loading pauses the read, and a word spanning several text nodes highlights whole. `ITTSProviderImplementation.updateSettings` is required and `HighlightCoordinator.highlightTTSWord` takes the word's ranges; the TTS settings panel picks browser voices for the content language, `TTSToolProvider` reports its speech provider's features, a failed speech-rule-engine load is retried on the next read and warned about once, server TTS telemetry names the tool `textToSpeech`, and read-aloud's debug lines log only under `PIE_TTS_DEBUG`.

## 0.3.74

### Patch Changes

- 25fd8d8: Loading a second copy of a player or tool into a page that already registered
  its custom elements no longer throws. The copy that registered a tag first keeps
  rendering it, the rule `pie-item-player` and the toolkit's elements already
  follow.
- 8e13d3d: Scoped CSS class names, and the identifiers the minifier derives alongside
  them, are the same whichever checkout builds the package.
- 598ac56: Published type declarations no longer import `svelte`, which a host without
  Svelte cannot resolve: under `skipLibCheck: false` its type-check failed with
  TS2307.
  
  The section-player debugger and TTS settings panels, `tool-answer-eliminator`,
  the inline calculators and `tool-tts-inline` now declare nothing from their root
  entry, because importing one only registers its element. A TypeScript import of
  the Svelte component that entry default-exports no longer type-checks.
  `section-player-tools-shared` and `tool-calculator-shared` declare their
  exported components without Svelte.
- 22bcd83: TTS tool settings accept `headers` and `assetOrigins` and pass them to
  `ServerTTSProvider`. `pie-tool-tts-inline` fires `pie-tool-active-change` only
  when its active state changes. Answer-eliminator toggles carry
  `aria-pressed="false"` from creation. The TTS settings panel uses the shared
  focus trap, so Tab order reaches controls inside a provider's shadow root and
  closing the panel returns focus to an opener inside one.
  `@pie-players/pie-players-shared/pie/tag-names` exports `parseVersionedTagName`.
- b2476be: These packages no longer declare dependencies that their builds inline or never
  import, so installing them installs fewer packages. A host that imports one of
  those packages itself, such as `@pie-players/pie-theme`'s stylesheets, declares
  it in its own `package.json`.

## 0.3.73

### Patch Changes

- Updated dependencies [e2fd6b8]
- Updated dependencies [83d30e3]
  - @pie-players/pie-players-shared@0.3.73
  - @pie-players/pie-assessment-toolkit@0.3.73
  - @pie-players/pie-theme@0.3.73

## 0.3.72

### Patch Changes

- Updated dependencies [249af7f]
  - @pie-players/pie-theme@0.3.72
  - @pie-players/pie-assessment-toolkit@0.3.72
  - @pie-players/pie-players-shared@0.3.72

## 0.3.71

### Patch Changes

- Updated dependencies [181b124]
- Updated dependencies [10b34c8]
- Updated dependencies [69f354e]
- Updated dependencies [6c089fd]
- Updated dependencies [ee795c8]
  - @pie-players/pie-assessment-toolkit@0.3.71
  - @pie-players/pie-theme@0.3.71
  - @pie-players/pie-players-shared@0.3.71

## 0.3.70

### Patch Changes

- Updated dependencies [e8ab025]
- Updated dependencies [9868ee1]
- Updated dependencies [599c657]
- Updated dependencies [e3169f8]
- Updated dependencies [b544a28]
- Updated dependencies [8b4e0e4]
- Updated dependencies [ab1b1a9]
- Updated dependencies [f10fa7d]
- Updated dependencies [3d6acc6]
- Updated dependencies [47ae660]
- Updated dependencies [c9267e5]
- Updated dependencies [da5b9da]
- Updated dependencies [e3169f8]
  - @pie-players/pie-players-shared@0.3.70
  - @pie-players/pie-assessment-toolkit@0.3.70
  - @pie-players/pie-theme@0.3.70

## 0.3.69

### Patch Changes

- b0223d6: Stop publishing `dist/vite.config.d.ts`. Nine packages emitted a declaration for their own Vite config because the dts pass ran over an unbounded TypeScript glob, and every one of them ships `dist`, so the file reached the tarball. No `exports` entry ever pointed at it, so nothing could import it — this is tarball contents, not API. `check:pack-integrity` now rejects a packed build-config declaration, so a new package cannot reintroduce one.
- Updated dependencies [ced07e0]
- Updated dependencies [004d38e]
- Updated dependencies [01eb0f9]
- Updated dependencies [cb99eae]
- Updated dependencies [8bb668b]
- Updated dependencies [787ad8f]
- Updated dependencies [3544e9d]
- Updated dependencies [6e2d488]
- Updated dependencies [cb99eae]
- Updated dependencies [3deb7a2]
- Updated dependencies [3017425]
  - @pie-players/pie-assessment-toolkit@0.3.69
  - @pie-players/pie-theme@0.3.69
  - @pie-players/pie-players-shared@0.3.69

## 0.3.68

### Patch Changes

- 951c222: Put the debug and inspection panels on the `--pie-*` contract.
  
  Every panel read DaisyUI's own `--color-*` slots — `--color-base-100`,
  `--color-base-200`, `--color-base-300`, `--color-base-content`, `--color-primary`
  and the state slots. That is the supported flow reversed: DaisyUI is meant to feed
  `--pie-*` through pie-theme's provider, and a component reading the slots directly
  follows the host's DaisyUI palette, or its own light literals where the host has
  none, but never the colour scheme the tester selected. Inspecting a section under
  White on Black meant a white panel over a dark page. Several surfaces were mixed
  toward `white` explicitly, so they stayed light however the slot resolved.
  
  Panel surfaces are now `--pie-text` on `--pie-background-dark`, the pair the
  contract certifies for a recessed surface. Not `--pie-background`, which is what
  `--color-base-100` maps to: a floating panel needs an opaque surface, and the light
  Base Theme sets `--pie-background` to `rgba(255, 255, 255, 0)` so a host's own
  backdrop shows through. Panel chrome — headers, buttons, tabs, table headers, code
  blocks — takes the `--pie-button-*` family, with `--pie-button-active-bg` kept
  paired with `--pie-button-color` since that is the only ink certified against it.
  
  Selected and destructive states moved from tinted fills to the boundary, so labels
  sit on a certified pair: `--pie-incorrect` for destructive, `--pie-missing` for
  warning, `--pie-tertiary` for informational, each of which clears 4.5:1 against the
  page on every scheme and so passes the 3:1 a boundary owes. Two literals stay by
  design and are documented where they sit: drop shadows, and the TTS modal's scrim,
  which recedes the page behind it and would wash it out if it followed an ink that
  inverts to white under a dark scheme.
  
  A source guard holds the boundary — no panel may read a DaisyUI slot or paint a
  colour with no `--pie-*` token — and a Playwright case checks that the tokens
  resolve to something legible once a panel is mounted in a themed page. Its
  load-bearing assertion is that the surface differs between a light and a dark
  scheme: the contrast ratios passed on the old version too, because the panel was
  white on both.
- 00b8a71: Localize player and tool chrome, with Dutch as the first complete locale.
  
  A host sets one attribute — `locale="nl-NL"` on `pie-item-player` or a
  section-player layout element, or `runtime.locale`, which wins — and every string
  the suite renders itself follows it: toolbar labels, tool panels, player status
  and error text, formative controls, live-region announcements, `aria-label`s.
  Unset, the rendered output is byte-identical to before, including every tool
  button's accessible name. The graceful default is `en-US` and never
  `navigator.language`: under fixed lockstep patch-only versioning a
  rendered-string change reaches live delivery on a host's next install with no
  build signal on their side, so a host that opts into nothing must keep exactly
  the chrome it has.
  
  Interface locale is the deployment's fact and no element can know it, so it travels
  as a composition context rather than through `model`: the toolkit publishes the
  resolved locale and one provider on its runtime context, and every capability
  resolves both through `connectToolRuntimeContext`. The change signal is the
  context's own republish, which matters because a catalog is a dynamic import —
  without a reactive read every label would pin the English that rendered a tick
  earlier, the same silent failure `composition-context.md` records twice. A
  component that finds no publisher falls back to an English-only default provider
  rather than rendering raw message keys, which is what keeps tools working in
  `print-player`, in Studio preview and in a bare harness.
  
  Content language is untouched and remains a separate concern on a separate
  channel. QTI 3's implementation guide states the independence directly: a
  candidate may choose an interface language which may or may not also be the
  language of the content. Conflating the two is why classic PIE renders Spanish
  widget chrome for a Spanish item.
  
  `@pie-players/pie-players-shared/i18n` is rebuilt around that. Catalogs are
  TypeScript modules keyed by full BCP-47 tag, replacing JSON keyed by bare
  language: the English catalog's shape now generates the `MessageKey` union, so a
  mistyped key is a compile error instead of a key rendered on screen — a key
  assembled at runtime has to be asserted through `dynamicMessageKey()`, which is
  greppable and pairs with `hasKey()` so a miss falls back to a literal — and `tsc`
  compiling a `.ts` catalog removes the `with { type: "json" }` import-attribute
  hazard that already broke every non-English locale once under Node's ESM loader.
  Requests resolve through RFC 4647 lookup and then primary-subtag widening, so
  POSIX `nl_NL`, bare `nl` and regional `nl-BE` all reach the `nl-NL` catalog;
  `SimpleI18n` gains `plural()` — `Intl.PluralRules` alone, so Arabic's
  `zero`/`two`/`few`/`many` and Polish's `few`/`many` are reachable — plus
  `withLocale()` for two players rendering different locales from one provider, and
  it no longer writes `lang`/`dir` to `document.documentElement`, which an embedded
  player has no business doing. Components stamp their own host instead.
  
  The module split is what keeps this off the wire. `i18n/types` is type-only and
  erases; `i18n/provider` carries the 5 KB English catalog; the dynamic loader map
  lives in `i18n/catalogs`, which players import and tools do not. Since every
  player and tool `vite.config.ts` sets `external: []`, that boundary is the
  difference between one locale chunk and eighteen tool bundles each carrying a
  catalog they will never load.
  
  `ToolRegistration` gains optional `nameKey` and `descriptionKey` beside the
  still-required `name` and `description`. The keys are supplied by
  `default-tool-loaders`, which owns the packaged capability set, and a
  host-authored registration with no keys renders its `name` verbatim.
  
  The English catalog does enumerate a `tools.<capability>` namespace per packaged
  capability, so `default-tool-loaders` is not the only file naming them.
  `check:capability-neutrality` is unaffected: what it protects is core not
  branching on a capability id or granting behaviour from one, and a message key
  does neither — it is inert text, resolved by whoever holds the id. Splitting the
  catalog per capability would satisfy the letter of it and cost both the
  single-reference coverage check and the bundle boundary that keeps locale strings
  out of eighteen tool bundles.
  
  English output is byte-identical. Every English catalog value reproduces the
  literal it replaced exactly, punctuation and inconsistencies included, because
  fixed lockstep patch-only versioning puts a reworded string into a host's live
  delivery on their next install with no signal on their side — and most of what
  this change touches is accessible names and live-region announcements, where a
  host may be asserting exact text. Where the pre-adoption code rendered the same
  concept in two forms, the catalog carries both rather than assembling one by
  interpolation: `tools.ruler` has three forms of each unit name, matching the Title
  Case button label, the lowercase announcement and the raw state token in the
  accessible name. Improving any of these strings is a separate change with its own
  entry.
  
  `en-US` and `nl-NL` are complete at 402 keys, and they are the only locales
  shipped. The pre-adoption `es`/`zh`/`ar` catalogs are deleted rather than
  re-keyed: 76 of their 142 keys named UI this codebase does not render — a
  section-builder, an assessment shell, 25 Desmos internals Desmos localizes
  itself, colour-scheme names the theme registry owns — while the strings actually
  on screen had no keys at all; the published `dist` omitted
  `with { type: "json" }` on exactly the three dynamic locale imports, so none of
  them could load outside a bundler in any version through `0.3.67`; and nothing
  read them, here or in any consumer checkout. Machine-filling the gap would ship
  strings nobody has read, to learners.
  
  `check:i18n-coverage` now runs in the pre-commit and CI gates: a locale declared
  complete must stay at 100%, a locale mid-translation can be listed as carried and
  is reported without gating, and either fails on a key English no longer defines.
  
  The pre-adoption i18n layer is replaced rather than versioned alongside.
  `BUNDLED_TRANSLATIONS`, `loadTranslations`, `SimpleI18n.tn()` and two Svelte
  composables are gone. A grep of all three consumer checkouts finds no call site
  for any of them outside build caches — the layer was published complete and
  unused, which is what made replacement the right move instead of a second
  parallel implementation of the kind that produced `I18nService` as a copy of
  `SimpleI18n`.
- Updated dependencies [2d8ce6a]
- Updated dependencies [27284f8]
- Updated dependencies [e94b097]
- Updated dependencies [67a3d7e]
- Updated dependencies [d68c01b]
- Updated dependencies [3f5e968]
- Updated dependencies [27284f8]
- Updated dependencies [67f286c]
- Updated dependencies [55016b5]
- Updated dependencies [89688fc]
- Updated dependencies [fc71c91]
- Updated dependencies [e94b097]
- Updated dependencies [00b8a71]
- Updated dependencies [6e1e053]
- Updated dependencies [e94b097]
- Updated dependencies [7c9fb28]
- Updated dependencies [979e643]
- Updated dependencies [1d9f2d3]
- Updated dependencies [c9e3404]
- Updated dependencies [e94b097]
- Updated dependencies [27284f8]
- Updated dependencies [9d3c500]
- Updated dependencies [5a13755]
- Updated dependencies [e0f1134]
- Updated dependencies [54742db]
- Updated dependencies [f61c7c7]
- Updated dependencies [0dc9c96]
- Updated dependencies [cb11691]
- Updated dependencies [4f0cb3f]
- Updated dependencies [e94b097]
  - @pie-players/pie-players-shared@0.3.68
  - @pie-players/pie-assessment-toolkit@0.3.68
  - @pie-players/pie-theme@0.3.68

## 0.3.67

### Patch Changes

- Updated dependencies [73d2be4]
- Updated dependencies [73d2be4]
- Updated dependencies [fe9b4f0]
- Updated dependencies [61d6aa0]
  - @pie-players/pie-theme@0.3.67
  - @pie-players/pie-assessment-toolkit@0.3.67

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
- Updated dependencies [556c422]
- Updated dependencies [2a741c6]
- Updated dependencies [5e6fcde]
- Updated dependencies [e8a6f0e]
- Updated dependencies [2bcd9fa]
- Updated dependencies [6bbfae1]
- Updated dependencies [1e0c10f]
- Updated dependencies [2bcd9fa]
- Updated dependencies [2bcd9fa]
- Updated dependencies [e8a6f0e]
- Updated dependencies [a4beb70]
- Updated dependencies [1f29de7]
- Updated dependencies [5e6fcde]
- Updated dependencies [5f133be]
- Updated dependencies [9a183cf]
  - @pie-players/pie-assessment-toolkit@0.3.66
  - @pie-players/pie-theme@0.3.66

## 0.3.65

### Patch Changes

- Updated dependencies [c16c77c]
- Updated dependencies [35f1cc9]
- Updated dependencies [c4c3aca]
- Updated dependencies [2b015a9]
- Updated dependencies [411b2cd]
- Updated dependencies [f0d5802]
- Updated dependencies [f588924]
- Updated dependencies [3f6e33a]
- Updated dependencies [3972f16]
- Updated dependencies [5183654]
- Updated dependencies [c59396b]
  - @pie-players/pie-theme@0.3.65
  - @pie-players/pie-assessment-toolkit@0.3.65

## 0.3.64

### Patch Changes

- Updated dependencies [82118ce]
- Updated dependencies [9b2f37d]
- Updated dependencies [acee584]
- Updated dependencies [9b2f37d]
- Updated dependencies [5749bc1]
- Updated dependencies [dc44392]
- Updated dependencies [82edb28]
- Updated dependencies [a5241b9]
- Updated dependencies [0dcec2e]
- Updated dependencies [acee584]
- Updated dependencies [25511d7]
- Updated dependencies [bbcabc0]
- Updated dependencies [30baec4]
  - @pie-players/pie-assessment-toolkit@0.3.64
  - @pie-players/pie-theme@0.3.64

## 0.3.63

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.63
- @pie-players/pie-theme@0.3.63

## 0.3.62

### Patch Changes

- 99929d8: Move debugger panel styling out of the shared content stylesheet and into the panels that own it.

  `components.css` carried a `SECTION PLAYER DEBUGGER OVERLAYS` block styling the PNP
  and session debugger panels. That file is for authored-content classes no component
  owns, so panel-private rules did not belong in it, and the split was already
  inconsistent: each panel defined most of its own classes locally and left a handful
  behind.

  Those rules now live in each panel's own `<style>` block. The two classes applied by
  `SharedFloatingPanel` rather than by the panel template — the panel root and
  `__content-shell` — are wrapped in `:global()`, since Svelte would otherwise scope
  them to the panel component and they would match nothing.

  Of the 37 classes in the removed block, 14 were referenced nowhere at all
  (`__header*`, `__title`, `__icon-button`, `__icon-xs`, `__resize-*`) — leftovers from
  before `SharedFloatingPanel` renamed those parts to `pie-shared-floating-panel__*`.
  They were deleted rather than relocated.

  Five panels also dropped a `@pie-players/pie-theme/components.css` import that never
  did anything: these packages build with Vite in library mode, so the import was
  extracted to a `dist` CSS file that the built JS never referenced and that no
  `exports` entry exposed — the same defect fixed for `PieItemPlayer.svelte`. Each
  package now ships one fewer dead file.

  If you import `@pie-players/pie-theme/components.css` directly and relied on the
  `pie-section-player-tools-{pnp,session}-debugger*` classes it used to define, they are
  no longer there; they ship with their panel packages instead.

- Updated dependencies [c73c995]
- Updated dependencies [c73c995]
- Updated dependencies [507b56f]
- Updated dependencies [14666b3]
- Updated dependencies [99929d8]
- Updated dependencies [a1edde5]
- Updated dependencies [7864f66]
- Updated dependencies [3b4e461]
- Updated dependencies [7605500]
- Updated dependencies [c810459]
  - @pie-players/pie-assessment-toolkit@0.3.62
  - @pie-players/pie-theme@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.61
- @pie-players/pie-theme@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.60
- @pie-players/pie-theme@0.3.60

## 0.3.59

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.59
  - @pie-players/pie-theme@0.3.59

## 0.3.58

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.58
- @pie-players/pie-theme@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.57
  - @pie-players/pie-theme@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.56
  - @pie-players/pie-theme@0.3.56

## 0.3.55

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.55
- @pie-players/pie-theme@0.3.55

## 0.3.54

### Patch Changes

- bead424: Make inline TTS speed controls a single-select radio-style group with visible Normal selected by default, while preserving host ordering and numeric helper compatibility.
- Updated dependencies [bead424]
  - @pie-players/pie-assessment-toolkit@0.3.54
  - @pie-players/pie-theme@0.3.54

## 0.3.53

### Patch Changes

- Updated dependencies [ee6c081]
  - @pie-players/pie-theme@0.3.53
  - @pie-players/pie-assessment-toolkit@0.3.53

## 0.3.52

### Patch Changes

- Updated dependencies [905080d]
  - @pie-players/pie-assessment-toolkit@0.3.52
  - @pie-players/pie-theme@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.51
  - @pie-players/pie-theme@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.50
  - @pie-players/pie-theme@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.49
  - @pie-players/pie-theme@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.48
  - @pie-players/pie-theme@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.47
  - @pie-players/pie-theme@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.46
  - @pie-players/pie-theme@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies [fd140a3]
  - @pie-players/pie-assessment-toolkit@0.3.45
  - @pie-players/pie-theme@0.3.45

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.44
  - @pie-players/pie-theme@0.3.44

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [6496dda]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.42
  - @pie-players/pie-theme@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.41
  - @pie-players/pie-theme@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.40
  - @pie-players/pie-theme@0.3.40

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0072fad]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.39
  - @pie-players/pie-theme@0.3.39

## 0.3.38

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [ef29724]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.38
  - @pie-players/pie-theme@0.3.38

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [2818f93]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.37
  - @pie-players/pie-theme@0.3.37

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [9ef211c]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.36
  - @pie-players/pie-theme@0.3.36

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [286418e]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.35
  - @pie-players/pie-theme@0.3.35

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [af850c0]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.34
  - @pie-players/pie-theme@0.3.34

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [70612af]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.33
  - @pie-players/pie-theme@0.3.33

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0355143]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.32
  - @pie-players/pie-theme@0.3.32

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [26dbea3]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.31
  - @pie-players/pie-theme@0.3.31

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.30
  - @pie-players/pie-theme@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.29
  - @pie-players/pie-theme@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.28
  - @pie-players/pie-theme@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.27
  - @pie-players/pie-theme@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-theme@0.3.20
