# @pie-players/pie-tool-color-scheme

## 0.3.69

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.69
  - @pie-players/pie-context@0.3.69
  - @pie-players/pie-players-shared@0.3.69
  - @pie-players/pie-theme@0.3.69

## 0.3.68

### Patch Changes

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
- 54742db: A second full-codebase review turned up more drift, duplication, and interface
  problems than the first sweep caught, concentrated in the TTS provider stack and
  the debugger-tool family. No public surface changes; behaviour fixes are called
  out explicitly.
  
  **TTS rate and pitch.** Polly and Google both advertised `supportsRate` /
  `supportsPitch` while never reading `request.rate` / `request.pitch` — a caller
  asking for a different speech rate got normal-speed audio with no error.
  `BaseTTSProvider.applyProsody` / `buildProsodyAttrs` now wrap plain-text requests
  in an SSML `<prosody>` envelope on both providers; already-SSML input is left
  alone. `pitch` follows this repo's existing 0-2 multiplier convention (the TTS
  settings UI's `normalizePitch`), converted to SSML's relative percentage form.
  
  **SchoolCity speech-mark timing.** `tts-client-server`'s custom-transport parser
  reimplemented SchoolCity's JSONL wire format from scratch, with none of the
  offset/time-unit corrections `SchoolCityServerProvider` applies — reproducing the
  mistiming bug that correction was built to fix. `normalizeSpeechMarks` moves to
  `tts-server-core` so both share one implementation.
  
  **TTS error-mapping granularity.** Polly collapsed every AWS SDK error to
  `PROVIDER_ERROR`; SchoolCity did the same for every HTTP failure. Both now map
  to `TEXT_TOO_LONG` / `INVALID_REQUEST` / `RATE_LIMIT_EXCEEDED` /
  `AUTHENTICATION_ERROR` where the underlying exception name or HTTP status
  says so, matching the granularity Google already had. A documented consumer maps
  these four `TTSErrorCode` members onto HTTP responses, so Polly's
  `TextLengthExceededException` reaching `TEXT_TOO_LONG` is newly correct handling
  on a path that previously always fell through to a generic error.
  
  **Rate-to-speedRate bucketing.** `SchoolCityServerProvider` and
  `ServerTTSProvider` each bucketed a numeric rate into `slow`/`medium`/`fast`
  with different thresholds, disagreeing for rate 1.1-1.49.
  `resolveSpeedRateBucket` in `tts-server-core` is now the one implementation,
  on the server's deliberate 0.95-1.5 tolerance band.
  
  **Shadow-DOM-blind theme lookup.** `tool-color-scheme`'s host lookup called
  `closest('pie-theme')` from inside its own open shadow root, which
  `Element.closest()` can never cross — on any page with more than one
  independently-scoped `<pie-theme>` it silently always picked the wrong one.
  `resolvePieThemeHost` in `pie-theme` walks out through each shadow root's host
  to find the real ancestor. The same change adds `applyPieColorScheme` as the one
  canonical "resolve host, set scheme, persist" sequence, replacing both
  `tool-color-scheme`'s own copy and `apps/section-demos`' independently-drifted
  version.
  
  **Debugger-panel subscription lifecycle.** `EventPanel` and `SectionSessionPanel`
  each reimplemented the same subscribe/detach/resubscribe scaffolding;
  `SectionSessionPanel`'s read and wrote reactive state directly inside a tracked
  `$effect` body instead of wrapping it in `untrack()`, and its lifecycle handler
  always resubscribed instead of distinguishing the disposed and same-target cases
  `EventPanel` already handled. `createSectionControllerSubscriptionManager` in
  `section-player-tools-shared` is now shared by both. The same change wires
  `persistence-scope` / `persistence-panel-id` through for `PnpPanel` and
  `SectionSessionPanel`, which had neither despite `SharedFloatingPanel` supporting
  layout persistence and two sibling debuggers already exposing it.
  
  **Pointer-drag tracking.** `tool-line-reader` and `tool-text-to-speech` each
  hand-rolled identical pointer-capture drag-position tracking.
  `createPointerDragController` in `players-shared/ui` covers the shared position
  math; `tool-line-reader`'s separate resize handling stays where it is.
  
  **Custom-element registration.** `pie-print` bypassed its own package's guarded
  registry and called Lit's `@customElement` decorator directly, which throws an
  uncaught `NotSupportedError` on double-bundling where every other player
  no-ops. It now goes through the same guard. `defineCustomElementSafely`
  (players-shared) and print-player's registry also shared the same
  duplicate-define handling with different collision coverage; consolidated into
  one implementation, which incidentally fixes a latent bug where an
  already-registered tag not tracked locally hit a doomed wrapped-subclass retry
  instead of short-circuiting.
  
  **Everything else.** `coerceBooleanLike` had three different, disagreeing
  implementations across `section-player` and `assessment-player` for the same
  attribute-coercion job; unified in `players-shared`. `sanitize-item-markup` and
  `sanitize-svg-icon`'s DOMPurify forbid-lists had drifted despite a comment
  claiming parity; now share one list. `AssessmentPlayerDefaultElement` swallowed
  TTS teardown errors in empty catch blocks instead of reporting them through
  `ToolkitCoordinator.reportFrameworkError`. `item-player`'s `"player-error"` event
  now has an exported constant matching the pattern `section-player` and
  `assessment-player` already use (no wire-value change).
- 27284f8: Re-register a tool with the coordinator when the coordinator instance changes,
  so stacking and visibility keep working after a runtime-context republish.
  
  Six tools registered once and never again. The guard was a `$state` boolean
  flipped inside a tracked `$effect` — `if (coordinator && toolId && !registered)`
  — so the first coordinator to arrive won permanently. The coordinator does not
  arrive once: it is read from the runtime context (a prop, for text-to-speech),
  and a republish hands over a new instance. After one, the tool's z-index layer,
  `bringToFront` and visibility-restore were all still pointing at a coordinator
  nobody consults, and the new one had never heard of the tool — so a ruler would
  not raise above a protractor, and a tool hidden and reshown lost its position.
  Teardown had the mirror fault: it unregistered `toolId` from whichever
  coordinator happened to be current, which after a swap is not the one holding
  the registration.
  
  Each of the six now tracks the coordinator and id it actually registered
  against, unregisters from that one before re-registering when either changes,
  and unregisters from it on destroy. The bookkeeping moved from `$state` to plain
  `let`, because a reactive write inside a tracked effect body is what AGENTS.md's
  Svelte Subscription Safety section rules out; the effect is now idempotent and
  compares stable identities rather than relying on a one-shot flag.
  
  `pie-tool-answer-eliminator` already re-registered correctly and is unchanged in
  behaviour. Its bookkeeping moves to plain `let` for the same reason, so all
  seven tools now carry one pattern.
  
  No public surface changes. A host that never republishes the runtime context
  sees exactly what it saw before.
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
  - @pie-players/pie-context@0.3.68

## 0.3.67

### Patch Changes

- Updated dependencies [b264ab2]
- Updated dependencies [73d2be4]
- Updated dependencies [73d2be4]
- Updated dependencies [fe9b4f0]
- Updated dependencies [61d6aa0]
  - @pie-players/pie-players-shared@0.3.67
  - @pie-players/pie-theme@0.3.67
  - @pie-players/pie-assessment-toolkit@0.3.67
  - @pie-players/pie-context@0.3.67

## 0.3.66

### Patch Changes

- 1f29de7: Make theme resolution one observable contract instead of separate runtime and
  stylesheet palettes.

  The light and dark Base Theme defaults and the two previously under-contrast
  built-in palettes now satisfy the named WCAG text, control-boundary, feedback,
  focus, and annotation relationships enforced by the theme contract. Hosts keep
  the same token names and can still override them through the normal cascade.

  `@pie-players/pie-theme` now owns light and dark base themes, complete built-in
  color schemes, custom-scheme registration, accessibility diagnostics, and
  generated CSS from one side-effect-free TypeScript definition. The public
  runtime interface is `resolvePieTheme`, `listPieColorSchemes`,
  `observePieColorSchemes`, and `registerPieColorSchemes`. Registration returns a
  generation-aware, idempotent receipt whose `unregister()` removes only the
  definition it registered. Built-in ids are reserved, invalid custom entries are
  rejected atomically, and valid entries from the same batch still register.

  Upgrade note: `listPieColorSchemes()` now returns an immutable snapshot rather
  than a mutable array of raw palette definitions. Raw built-in/base constants,
  authored preview values, and the one-off get/resolve/unregister scheme helpers
  are no longer public. Consumers should render `snapshot.schemes`, derive values
  through `resolvePieTheme()`, observe catalog changes when mounted, and retain the
  registration receipt when they need to unregister custom schemes.

  An unknown requested scheme is no longer silently replaced. `<pie-theme>` keeps
  the requested id in `scheme` and `data-color-scheme`, applies the safe base and
  provider result plus explicit variables, and automatically resolves it if
  registration arrives later. This preserves a CSS-only selector hook while
  making registered custom schemes the managed path. CSS-only schemes use the
  normal cascade in stylesheet-only integrations; a rule competing with a mounted
  `<pie-theme>`'s inline tokens must deliberately use `!important`.

  `@pie-players/pie-tool-theme` now follows that observable catalog and derives
  previews from resolved tokens. If a saved scheme is unavailable, the picker
  keeps the preference, shows a disabled unavailable option and status message,
  and restores the scheme after late registration. The old `schemes` and
  `schemeCatalog` inputs are removed; no recorded client-facing host depends on
  them.

  The shared focus trap now resolves and restores focus inside open shadow roots,
  so keyboard containment and Escape restoration work for the theme picker's
  shadow-DOM controls.

  The checked-in `tokens.css` and `color-schemes.css` files remain at their exact
  published paths and remain unlayered so host token declarations and
  `!important` overrides keep working. They are generated explicitly and checked
  for staleness; package builds verify them without rewriting tracked source.
  Importing the package root still registers `<pie-theme>`, while importing
  `@pie-players/pie-theme/theme-element` remains side-effect-free.

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
  - @pie-players/pie-players-shared@0.3.66
  - @pie-players/pie-theme@0.3.66
  - @pie-players/pie-context@0.3.66

## 0.3.65

### Patch Changes

- Updated dependencies [c16c77c]
- Updated dependencies [35f1cc9]
- Updated dependencies [c5fbf21]
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
  - @pie-players/pie-players-shared@0.3.65
  - @pie-players/pie-context@0.3.65

## 0.3.64

### Patch Changes

- Updated dependencies [82118ce]
- Updated dependencies [9b2f37d]
- Updated dependencies [acee584]
- Updated dependencies [9b2f37d]
- Updated dependencies [5749bc1]
- Updated dependencies [bb1a90b]
- Updated dependencies [dc44392]
- Updated dependencies [82edb28]
- Updated dependencies [a5241b9]
- Updated dependencies [0dcec2e]
- Updated dependencies [acee584]
- Updated dependencies [b3acac4]
- Updated dependencies [25511d7]
- Updated dependencies [bbcabc0]
- Updated dependencies [30baec4]
  - @pie-players/pie-assessment-toolkit@0.3.64
  - @pie-players/pie-players-shared@0.3.64
  - @pie-players/pie-theme@0.3.64
  - @pie-players/pie-context@0.3.64

## 0.3.63

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.63
- @pie-players/pie-context@0.3.63
- @pie-players/pie-players-shared@0.3.63
- @pie-players/pie-theme@0.3.63

## 0.3.62

### Patch Changes

- Updated dependencies [c73c995]
- Updated dependencies [c73c995]
- Updated dependencies [507b56f]
- Updated dependencies [14666b3]
- Updated dependencies [99929d8]
- Updated dependencies [001486e]
- Updated dependencies [6a18f3c]
- Updated dependencies [a1edde5]
- Updated dependencies [7864f66]
- Updated dependencies [3b4e461]
- Updated dependencies [7605500]
- Updated dependencies [c810459]
  - @pie-players/pie-assessment-toolkit@0.3.62
  - @pie-players/pie-theme@0.3.62
  - @pie-players/pie-players-shared@0.3.62
  - @pie-players/pie-context@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.61
- @pie-players/pie-context@0.3.61
- @pie-players/pie-players-shared@0.3.61
- @pie-players/pie-theme@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.60
- @pie-players/pie-context@0.3.60
- @pie-players/pie-players-shared@0.3.60
- @pie-players/pie-theme@0.3.60

## 0.3.59

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.59
  - @pie-players/pie-context@0.3.59
  - @pie-players/pie-players-shared@0.3.59
  - @pie-players/pie-theme@0.3.59

## 0.3.58

### Patch Changes

- Updated dependencies [8df52bf]
- Updated dependencies [d5cc905]
  - @pie-players/pie-players-shared@0.3.58
  - @pie-players/pie-assessment-toolkit@0.3.58
  - @pie-players/pie-context@0.3.58
  - @pie-players/pie-theme@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.57
  - @pie-players/pie-context@0.3.57
  - @pie-players/pie-players-shared@0.3.57
  - @pie-players/pie-theme@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.56
  - @pie-players/pie-context@0.3.56
  - @pie-players/pie-players-shared@0.3.56
  - @pie-players/pie-theme@0.3.56

## 0.3.55

### Patch Changes

- Updated dependencies [7f45877]
  - @pie-players/pie-players-shared@0.3.55
  - @pie-players/pie-assessment-toolkit@0.3.55
  - @pie-players/pie-context@0.3.55
  - @pie-players/pie-theme@0.3.55

## 0.3.54

### Patch Changes

- Updated dependencies [bead424]
  - @pie-players/pie-assessment-toolkit@0.3.54
  - @pie-players/pie-context@0.3.54
  - @pie-players/pie-players-shared@0.3.54
  - @pie-players/pie-theme@0.3.54

## 0.3.53

### Patch Changes

- Updated dependencies [ee6c081]
  - @pie-players/pie-theme@0.3.53
  - @pie-players/pie-assessment-toolkit@0.3.53
  - @pie-players/pie-context@0.3.53
  - @pie-players/pie-players-shared@0.3.53

## 0.3.52

### Patch Changes

- Updated dependencies [905080d]
- Updated dependencies [017f5a9]
  - @pie-players/pie-assessment-toolkit@0.3.52
  - @pie-players/pie-players-shared@0.3.52
  - @pie-players/pie-context@0.3.52
  - @pie-players/pie-theme@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.51
  - @pie-players/pie-context@0.3.51
  - @pie-players/pie-players-shared@0.3.51
  - @pie-players/pie-theme@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.50
  - @pie-players/pie-context@0.3.50
  - @pie-players/pie-players-shared@0.3.50
  - @pie-players/pie-theme@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.49
  - @pie-players/pie-context@0.3.49
  - @pie-players/pie-players-shared@0.3.49
  - @pie-players/pie-theme@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0c20d0f]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.48
  - @pie-players/pie-assessment-toolkit@0.3.48
  - @pie-players/pie-context@0.3.48
  - @pie-players/pie-theme@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.47
  - @pie-players/pie-context@0.3.47
  - @pie-players/pie-players-shared@0.3.47
  - @pie-players/pie-theme@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.46
  - @pie-players/pie-context@0.3.46
  - @pie-players/pie-players-shared@0.3.46
  - @pie-players/pie-theme@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies [fd140a3]
  - @pie-players/pie-assessment-toolkit@0.3.45
  - @pie-players/pie-context@0.3.45
  - @pie-players/pie-players-shared@0.3.45
  - @pie-players/pie-theme@0.3.45

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.44
  - @pie-players/pie-context@0.3.44
  - @pie-players/pie-players-shared@0.3.44
  - @pie-players/pie-theme@0.3.44

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [6496dda]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.42
  - @pie-players/pie-context@0.3.42
  - @pie-players/pie-players-shared@0.3.42
  - @pie-players/pie-theme@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.41
  - @pie-players/pie-context@0.3.41
  - @pie-players/pie-players-shared@0.3.41
  - @pie-players/pie-theme@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [3a167a8]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.40
  - @pie-players/pie-assessment-toolkit@0.3.40
  - @pie-players/pie-context@0.3.40
  - @pie-players/pie-theme@0.3.40

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0072fad]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.39
  - @pie-players/pie-players-shared@0.3.39
  - @pie-players/pie-context@0.3.39
  - @pie-players/pie-theme@0.3.39

## 0.3.38

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [f856362]
- Updated dependencies [ef29724]
- Updated dependencies [c8d46d7]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.38
  - @pie-players/pie-assessment-toolkit@0.3.38
  - @pie-players/pie-context@0.3.38
  - @pie-players/pie-theme@0.3.38

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [2818f93]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.37
  - @pie-players/pie-context@0.3.37
  - @pie-players/pie-players-shared@0.3.37
  - @pie-players/pie-theme@0.3.37

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [9ef211c]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.36
  - @pie-players/pie-context@0.3.36
  - @pie-players/pie-players-shared@0.3.36
  - @pie-players/pie-theme@0.3.36

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [286418e]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.35
  - @pie-players/pie-context@0.3.35
  - @pie-players/pie-players-shared@0.3.35
  - @pie-players/pie-theme@0.3.35

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [af850c0]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.34
  - @pie-players/pie-context@0.3.34
  - @pie-players/pie-players-shared@0.3.34
  - @pie-players/pie-theme@0.3.34

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [70612af]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.33
  - @pie-players/pie-context@0.3.33
  - @pie-players/pie-players-shared@0.3.33
  - @pie-players/pie-theme@0.3.33

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0355143]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.32
  - @pie-players/pie-context@0.3.32
  - @pie-players/pie-players-shared@0.3.32
  - @pie-players/pie-theme@0.3.32

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [26dbea3]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.31
  - @pie-players/pie-players-shared@0.3.31
  - @pie-players/pie-context@0.3.31
  - @pie-players/pie-theme@0.3.31

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0981bc3]
- Updated dependencies [698aa82]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.30
  - @pie-players/pie-assessment-toolkit@0.3.30
  - @pie-players/pie-context@0.3.30
  - @pie-players/pie-theme@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.29
  - @pie-players/pie-context@0.3.29
  - @pie-players/pie-players-shared@0.3.29
  - @pie-players/pie-theme@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.28
  - @pie-players/pie-context@0.3.28
  - @pie-players/pie-players-shared@0.3.28
  - @pie-players/pie-theme@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.27
  - @pie-players/pie-context@0.3.27
  - @pie-players/pie-players-shared@0.3.27
  - @pie-players/pie-theme@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.26
  - @pie-players/pie-context@0.3.26
  - @pie-players/pie-players-shared@0.3.26
  - @pie-players/pie-theme@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.25
  - @pie-players/pie-context@0.3.25
  - @pie-players/pie-players-shared@0.3.25
  - @pie-players/pie-theme@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.25
  - @pie-players/pie-context@0.3.25
  - @pie-players/pie-players-shared@0.3.25
  - @pie-players/pie-theme@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.24
  - @pie-players/pie-context@0.3.24
  - @pie-players/pie-players-shared@0.3.24
  - @pie-players/pie-theme@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.23
  - @pie-players/pie-context@0.3.23
  - @pie-players/pie-players-shared@0.3.23
  - @pie-players/pie-theme@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.22
  - @pie-players/pie-context@0.3.22
  - @pie-players/pie-players-shared@0.3.22
  - @pie-players/pie-theme@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.21
  - @pie-players/pie-context@0.3.21
  - @pie-players/pie-players-shared@0.3.21
  - @pie-players/pie-theme@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.20
  - @pie-players/pie-context@0.3.20
  - @pie-players/pie-players-shared@0.3.20
  - @pie-players/pie-theme@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.19
  - @pie-players/pie-context@0.3.19
  - @pie-players/pie-players-shared@0.3.19
  - @pie-players/pie-theme@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.18
  - @pie-players/pie-context@0.3.18
  - @pie-players/pie-players-shared@0.3.18
  - @pie-players/pie-theme@0.3.18

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.17
  - @pie-players/pie-context@0.3.17
  - @pie-players/pie-players-shared@0.3.17
  - @pie-players/pie-theme@0.3.17

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.16
  - @pie-players/pie-context@0.3.16
  - @pie-players/pie-players-shared@0.3.16
  - @pie-players/pie-theme@0.3.16

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.15
  - @pie-players/pie-context@0.3.15
  - @pie-players/pie-players-shared@0.3.15
  - @pie-players/pie-theme@0.3.15

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.14
  - @pie-players/pie-context@0.3.14
  - @pie-players/pie-players-shared@0.3.14
  - @pie-players/pie-theme@0.3.14

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.13
  - @pie-players/pie-context@0.3.13
  - @pie-players/pie-players-shared@0.3.13
  - @pie-players/pie-theme@0.3.13

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.12
  - @pie-players/pie-context@0.3.12
  - @pie-players/pie-players-shared@0.3.12
  - @pie-players/pie-theme@0.3.12

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.11
  - @pie-players/pie-context@0.3.11
  - @pie-players/pie-players-shared@0.3.11
  - @pie-players/pie-theme@0.3.11

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.10
  - @pie-players/pie-context@0.3.10
  - @pie-players/pie-players-shared@0.3.10
  - @pie-players/pie-theme@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.9
  - @pie-players/pie-context@0.3.9
  - @pie-players/pie-players-shared@0.3.9
  - @pie-players/pie-theme@0.3.9

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.10
  - @pie-players/pie-context@0.3.10
  - @pie-players/pie-players-shared@0.3.10
  - @pie-players/pie-theme@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.9
  - @pie-players/pie-context@0.3.9
  - @pie-players/pie-players-shared@0.3.9
  - @pie-players/pie-theme@0.3.9

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.8
  - @pie-players/pie-context@0.3.8
  - @pie-players/pie-players-shared@0.3.8
  - @pie-players/pie-theme@0.3.8

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.7
  - @pie-players/pie-context@0.3.7
  - @pie-players/pie-players-shared@0.3.7
  - @pie-players/pie-theme@0.3.7

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.6
  - @pie-players/pie-context@0.3.6
  - @pie-players/pie-players-shared@0.3.6
  - @pie-players/pie-theme@0.3.6

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.5
  - @pie-players/pie-context@0.3.5
  - @pie-players/pie-players-shared@0.3.5
  - @pie-players/pie-theme@0.3.5

## 0.3.4

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.4
  - @pie-players/pie-context@0.3.4
  - @pie-players/pie-players-shared@0.3.4
  - @pie-players/pie-theme@0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.3
  - @pie-players/pie-context@0.3.3
  - @pie-players/pie-players-shared@0.3.3
  - @pie-players/pie-theme@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.2
  - @pie-players/pie-context@0.3.2
  - @pie-players/pie-players-shared@0.3.2
  - @pie-players/pie-theme@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.1
  - @pie-players/pie-context@0.3.1
  - @pie-players/pie-players-shared@0.3.1
  - @pie-players/pie-theme@0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

- Updated dependencies
- Updated dependencies [9385ce0]
  - @pie-players/pie-assessment-toolkit@0.3.0
  - @pie-players/pie-context@0.3.0
  - @pie-players/pie-players-shared@0.3.0
  - @pie-players/pie-theme@0.3.0

## 0.1.10

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/pie-assessment-toolkit@0.2.10
  - @pie-players/pie-context@0.1.2
  - @pie-players/pie-players-shared@0.2.6
  - @pie-players/pie-theme@0.1.2

## 0.1.9

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
- Updated dependencies [71a9581]
  - @pie-players/pie-assessment-toolkit@0.2.9
  - @pie-players/pie-context@0.1.1
  - @pie-players/pie-players-shared@0.2.5
