# @pie-players/pie-item-player

## 0.3.70

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.70
  - @pie-players/pie-theme@0.3.70

## 0.3.69

### Patch Changes

- Updated dependencies [01eb0f9]
- Updated dependencies [8bb668b]
- Updated dependencies [3deb7a2]
- Updated dependencies [3017425]
  - @pie-players/pie-theme@0.3.69
  - @pie-players/pie-players-shared@0.3.69

## 0.3.68

### Patch Changes

- f71c7c1: Let a host override the content's autoplay decision through an
  `autoplay-audio-enabled` attribute on `<pie-item-player>`.
  
  `autoplayAudioEnabled` is a model field the Learnosity → PIE transform derives per
  item from its `rli-kas:STARcollection` tag, and the imported value was the only
  answer available at delivery time. The prop is tri-state. Left `undefined` — the
  default, and what every host gets without opting in — `applyAutoplayAudioOverride`
  returns the same object identity and the config reaches the elements untouched. Set
  to `true` or `false`, the value is written onto every entry in `models`, including
  entries that never declared the field, so one host answer covers the whole item and
  the player stops distinguishing "the content said false" from "the host said false".
  
  It runs inside `prepareConfigEntity`, after `normalizePreloadedElementVersions` and
  before `makeUniqueTags`, so a stimulus item's passage config is covered on the same
  terms as its item config. Changing the prop re-enters `loadConfig` rather than
  mutating a mounted element; the session controller is keyed by item id and is not
  reset on that path, so a toggle mid-item does not discard responses.
  
  The override is host surface, not a PNP policy id — it claims no AfA support token
  and reads nothing about the learner, so it does not foreclose the per-program answer
  `docs/prds/audio-accommodations.md` argues for. That PRD leaves open whether
  runtime-adjustable autoplay is required at all: its position is that autoplay goes
  both ways *by program*, which makes `MapLearnosityToPieOptions.autoplay.byCollection`
  in `pie-api-aws` the natural home and costs PIE nothing. The two paths coexist —
  with the prop unset the transform's answer stands unchanged — so whether the
  requirement is genuinely runtime-adjustable is still a product decision this does
  not settle.
  
  Covered by `packages/item-player/tests/autoplay-audio-override.test.ts`.
- 5de2375: Scale the learner-facing text that sits outside the scaled content hosts.
  
  `font-sizes.css` scales `pie-item-shell`, `pie-passage-shell` and
  `pie-item-player`, and text inside them that inherits its size follows. Five
  declarations did not, and four of them are text a learner reads: the item and
  passage card titles, the formative status line carrying tries-remaining and
  correctness, the item player's build warning, and the tabbed layout's tab labels.
  At the 175% preset the item body grew and those stayed put.
  
  The cards are the reason inheritance was never going to cover it — a card *wraps*
  the shell that gets scaled, so nothing above these rules carries the scaled size.
  Each now reads `--pie-font-scale` directly, root-relative rather than as an `em`
  factor, because the scaled hosts nest inside the cards and an `em` factor would
  compound a requested 1.25 into 1.56.
  
  The tab label was a hard `12px`, the last pixel type size in the content path. It
  ignored the accommodation and the reader's own browser font size together, so tab
  labels stayed 12px beside body text at 175%. It is `0.75rem` now — the same 12px
  at a default root, diverging only for a host that moves the root size, which is
  what using rem is for.
  
  Nothing changes when no host opts in: `var(--pie-font-scale, 1)` resolves to 1 and
  every one of these renders exactly as before.
  
  Tool and debug chrome is deliberately excluded. An accommodation applies to what
  the learner reads, and a calculator keypad growing with the passage is a layout
  problem rather than an accommodation.
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
- 55016b5: Fold the player error banners into the palette when a colour scheme asks for one.
  
  The three banners — two in `players-shared`'s `PieItemPlayer`, one in
  `pie-item-player` — were painted with a pinned `#d32f2f` edge, `#ffebee` fill and
  `#c62828` ink. That was never a contrast failure, since fill and ink were pinned
  together and measure about 6.2:1 wherever they render. It was a palette failure: a
  learner on White on Black or Yellow on Navy met a pale pink box in the middle of
  the scheme they chose in order to be able to read the screen.
  
  All three now use `--pie-fixed-hue-collapse`, exact at 0% for every Base Theme and
  folded at 100% for every scheme. The collapsed ink is `--pie-text`, not
  `--pie-incorrect`: the error hue against this tint drops to 4.14:1 under Black on
  White, where the page's own ink holds at 6.18:1 or better on all ten schemes. That
  pair is now a declared contrast relationship, `incorrect feedback surface text`, so
  `assertCanonicalThemeDefinitions` keeps it true for any scheme added later rather
  than it having been measured once.
  
  `--pie-incorrect-secondary` is a tint of the page, roughly 1.1:1 from it, so the
  collapsed banner reads as a banner by its `--pie-incorrect` edge — which clears
  4.53:1 against every scheme's page. This is the division of labour the periodic
  table's collapsed cells already rely on.
  
  The colours moved out of the inline `style` attributes into each component's
  `.pie-player-error` rule. An inline declaration outranks any stylesheet, so a host
  could not have restyled the banner without `!important`; it now behaves like the
  rest of the players' chrome.
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
- 9631742: Move the backend delivery and authoring state machine out of `PieItemPlayer.svelte`
  into `src/backend/orchestrator.svelte.ts`, and load the built-in pie-api transport
  on demand.
  
  No behaviour change. The custom-element surface — 45 props, the imperative
  `loadFromBackend`/`saveSession`/`score`/`saveContent`/`releaseContent` methods, and
  the `backend-*` event payloads and their emission order — is identical; the exported
  methods are now one-line delegations to the orchestrator.
  
  The component was carrying 233 lines of backend orchestration spread across most of
  its length: two config/session overrides, five signature and generation counters,
  three request-token race guards, four effects and the autosave debounce, none of
  which render anything. `createBackendOrchestrator` owns that state and takes getters
  over `backend`, the two configs, `env` and the session container plus three
  callbacks — run the element-load pipeline, dispatch a player event, commit refreshed
  models to the rendered elements. Those three callbacks are the whole DOM contract:
  the module imports neither the renderer, the element loader nor the style scoping, so
  the component keeps sole ownership of the DOM and the orchestrator is readable
  without it. The config selectors stay statically imported, because the signature
  computations that drive the effects are synchronous reads over the backend config
  object.
  
  `stableStringifyForKey` moves to `src/utils/stable-stringify.ts`: the component's
  config and renderer keys and the orchestrator's session signatures have to agree on
  what "unchanged" means, and a copy in each would let them drift.
  
  `pie-api-client.ts` is dead weight for any host that supplies its own
  `delivery.client`, and every call site was already async, so `delivery.ts` and
  `authoring.ts` reach it through `await import("./pie-api-client.js")`. It leaves the
  entry for its own chunk — the endpoint table, token resolution and fetch wrapper are
  no longer in `dist/pie-item-player.js`. Not a meaningful size win at ~3 KB gzipped
  against a 51 KB entry; it is the boundary that matters, in that the transport a host
  has replaced is now provably unreferenced.
  
  Covered by the existing backend unit tests and the backend delivery, section,
  authoring-contract and authoring-media e2e specs.
- 27284f8: Remove four duplicated public surfaces. Each was audited against all three
  consumer checkouts first; none of the removed names is consumed by any of them.
  
  **The toolkit's forked `DesmosCalculatorProvider` is gone** from the
  `./tools/client` subpath. `@pie-players/pie-calculator-desmos` owns that class,
  and the toolkit's own runtime path already instantiated *its* copy — the fork was
  reachable only as public API. The two were not interchangeable: the canonical
  provider takes `initialize({ apiKey, proxyEndpoint, onTelemetry })` and documents
  `proxyEndpoint` as the way to keep the key server-side, while the fork accepted
  only `{ apiKey }` and otherwise read `process.env.DESMOS_API_KEY` or
  `window.PIE_DESMOS_API_KEY`. So the published subpath offered the one variant with
  no server-side key path, and a host serving a Desmos proxy endpoint could not use
  it. `tool-calculator-desmos`'s setup docs now point at the canonical package and at
  `proxyEndpoint` rather than at a bare key.
  
  **`TTSToolConfig` is now defined in terms of `TTSRuntimeSettings`** instead of
  redeclaring its 23 fields. They had drifted in both directions, which is how
  `mathTokenHighlighting` came to be honoured at runtime while being unnameable on
  the coordinator's public `ensureTTSReady` except through an index signature. It is
  nameable now, along with `showSingleSpeedOption` — the change is additive on the
  host-facing surface and removes nothing. It is an intersection rather than an
  interface because `ToolConfig.provider` is `unknown` where the runtime settings
  narrow it to the three provider ids, and an interface cannot inherit a member two
  parents type differently.
  
  **`AuthoringValidationResult` is re-exported from `pie-item-player`** rather than
  redeclared there. The local copy widened `validatedModels` to `any[]` while
  `validateModels()` is implemented against `players-shared`'s
  `Array<PieModel & { validation?: unknown }>`, so a consumer typing against this
  package lost the model typing the implementation actually returns. The name still
  exports from here; only its precision changes.
  
  **The `highlighter` capability is removed** from `default-tool-loaders`, along with
  `highlighterToolRegistration`. It mounted `pie-tool-annotation-toolbar` through the
  same loader as `annotationToolbar`, carried the same `"Highlighter"` name and
  `highlighter` icon, and was placed at the same four levels, so an exhaustive host
  rendered two identically-labelled buttons opening the same element. That collision
  was already known: the placement test excluded `highlighter` from one preset by
  hand.
  
  No grant is lost. `annotationToolbarRegistration.pnpSupportIds` already accepted
  all three of the removed capability's ids, and its three `universalSupportIds`
  (`highlighter`, `textHighlight`, `annotation`) moved onto the surviving capability,
  so a profile granted any of them still gets highlighting. What does change is that
  annotation highlighting is now reached only through the selection gateway, not
  additionally through a toolbar toggle. `PACKAGED_TOOL_ORDER` and
  `PACKAGED_TOOL_PLACEMENT` lose the id, and their hand-written tuple casts were
  corrected to match — left alone they would have declared a capability the runtime
  arrays no longer contain.
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
- Updated dependencies [2d8ce6a]
- Updated dependencies [27284f8]
- Updated dependencies [d68c01b]
- Updated dependencies [3f5e968]
- Updated dependencies [67f286c]
- Updated dependencies [55016b5]
- Updated dependencies [89688fc]
- Updated dependencies [fc71c91]
- Updated dependencies [00b8a71]
- Updated dependencies [6e1e053]
- Updated dependencies [e94b097]
- Updated dependencies [7c9fb28]
- Updated dependencies [979e643]
- Updated dependencies [1d9f2d3]
- Updated dependencies [c9e3404]
- Updated dependencies [9d3c500]
- Updated dependencies [5a13755]
- Updated dependencies [e0f1134]
- Updated dependencies [54742db]
- Updated dependencies [cb11691]
  - @pie-players/pie-players-shared@0.3.68
  - @pie-players/pie-theme@0.3.68

## 0.3.67

### Patch Changes

- Updated dependencies [b264ab2]
- Updated dependencies [73d2be4]
- Updated dependencies [73d2be4]
  - @pie-players/pie-players-shared@0.3.67
  - @pie-players/pie-theme@0.3.67

## 0.3.66

### Patch Changes

- e8a6f0e: Fix the element-cell text in the periodic table, and the last two colours set
  from JS.

  The periodic table encodes element categories as fixed pastel fills, and the
  symbol and name on them inherited `--pie-text` — near-white under every dark
  theme, leaving the cell text at about 1.2:1 on a pastel. The fills are a data
  encoding, so their ink is pinned to match: the tightest pairing it leaves is the
  0.8-opacity atomic mass on the darkest fill, at 6.0:1. The selected-element panel
  takes the theme surface rather than a category fill, so it keeps theme ink.

  Under a colour scheme the fills collapse into the palette instead; see the
  separate entry for `--pie-fixed-hue-collapse`.

  The print player's "cannot load" frame drew bare `red` — 4:1 on white, and print
  is the one surface where nobody sees the problem until it is on paper — and the
  item player set a `#ddd` divider between stacked elements. Both now resolve
  through the theme's families. `check:theme-tokens` gained a rule for this shape:
  a paint set from an inline style string or a `.style.x =` assignment with a bare
  literal now fails, which is how these two survived a stylesheet-only audit.

- 2bcd9fa: Paint the remaining player and tool chrome from the active theme.

  The floating tool shell's header fell back to `#f3f4f6` whenever the host had not
  set `--pie-section-player-card-header-background`, which is the normal case, so
  the shell's themed title text sat on a light grey strip — 2.3:1 under `pastel`,
  worse under the dark themes. It now defaults through `--pie-button-active-bg`,
  the mapping's contrast-tuned one-step-off-the-page fill, whose light value is the
  `#f3f4f6` that was pinned; the title measures 14.7:1 under `dracula`, 16.0:1 under
  `light` and 4.5:1 under `valentine`, and the light theme is unchanged.

  The three scrolling panes defaulted `--pie-scrollbar-thumb`,
  `--pie-scrollbar-track` and `--pie-scrollbar-thumb-hover` to greys, and nothing
  sets those hooks, so a light scrollbar shipped on every dark theme and colour
  scheme. Thumb and hover now default through `--pie-border` and
  `--pie-border-dark`, which the mapping corrects to 3:1 against the surface, and
  the track through `--pie-background-dark`.

  Also routed through tokens: the Desmos calculator frame and its loading/error
  overlay, the inline calculator's focus ring and glyph colours, the toolkit's
  framework-error panel, the item-player build warning, the preview toggle's tabs
  and the tool-settings hover tint, which now mixes from `currentColor` so it
  tracks whatever header it sits on.

  The embedded Desmos canvas stays white by decision: the third-party calculator
  paints its own white UI and a themed mount would only band it. The frame around
  it follows the theme so the shell's header and window controls read against it.

- Updated dependencies [556c422]
- Updated dependencies [5e6fcde]
- Updated dependencies [e8a6f0e]
- Updated dependencies [2bcd9fa]
- Updated dependencies [6bbfae1]
- Updated dependencies [1e0c10f]
- Updated dependencies [2bcd9fa]
- Updated dependencies [e8a6f0e]
- Updated dependencies [a4beb70]
- Updated dependencies [1f29de7]
  - @pie-players/pie-players-shared@0.3.66
  - @pie-players/pie-theme@0.3.66

## 0.3.65

### Patch Changes

- c5fbf21: `baseHeadingLevel` and `includeSrHeading` reflect to attributes on `<pie-item-player>`, so a host controls the item's heading outline for the whole session rather than only its first paint.

  A PIE element resolves both itself: it walks up to the nearest `pie-player` / `pie-item-player`, reads the property, falls back to the `base-heading-level` / `include-sr-heading` attribute, and re-renders on a MutationObserver watching those two attributes. The player therefore has to put the value where the element looks. `baseHeadingLevel` was registered without `reflect`, and `includeSrHeading` was not a declared prop at all — it reached the element as an expando. Both were honoured at first paint and inert after it, which made the accommodation unusable anywhere the host adjusts it in response to the learner's profile or a change of surrounding page structure.

  `includeSrHeading` is now declared, typed on `PieItemPlayerElement`, and reflected. Because its default is `true`, hosts turn it off through the property: reflection then clears the attribute, and a present boolean attribute means on whatever its value.

  No host code changes. A host already passing either prop starts getting live updates; one passing neither is unaffected.

  The documented level arithmetic was off by one and is corrected. `baseHeadingLevel` names the level the item's heading occupies, not the level the element emits: the element puts its visually-hidden item heading there when `includeSrHeading` is on, and expects the host's own natural heading there when it is off. Authored `data-heading` content nests one level below either way, so `baseHeadingLevel: 2` yields `h2` for the item heading and `h3`/`h4` for `heading1`/`heading2`. The old text described `@pie-element/*` before it read the host at all, when the rewrite ran off a hardcoded default.

- Updated dependencies [c16c77c]
- Updated dependencies [c5fbf21]
- Updated dependencies [3f6e33a]
  - @pie-players/pie-theme@0.3.65
  - @pie-players/pie-players-shared@0.3.65

## 0.3.64

### Patch Changes

- Updated dependencies [9b2f37d]
- Updated dependencies [bb1a90b]
- Updated dependencies [dc44392]
- Updated dependencies [a5241b9]
- Updated dependencies [acee584]
- Updated dependencies [b3acac4]
- Updated dependencies [25511d7]
  - @pie-players/pie-players-shared@0.3.64
  - @pie-players/pie-theme@0.3.64

## 0.3.63

### Patch Changes

- @pie-players/pie-players-shared@0.3.63
- @pie-players/pie-theme@0.3.63

## 0.3.62

### Patch Changes

- 14666b3: Install the shared PIE content stylesheet from the player instead of requiring hosts to import it.

  `@pie-players/pie-theme/components.css` holds classes that authored content depends on but no component owns: passage markup (`.numbered-paragraph`, `.p-number`, `div.passage-title`), the legacy `kds-*` families, and the `pie-answer-eliminator-*` styles. `PieItemPlayer.svelte` already imported that stylesheet, but in this package's Vite library build a plain CSS import is extracted to `dist/assets/pie-item-player.css` — a file nothing loads at runtime and no `exports` entry exposes. The import was a silent no-op, so hosts rendered authored passages unstyled unless they happened to import the stylesheet themselves, which was documented nowhere.

  `@pie-players/pie-item-player` now inlines the stylesheet as text (`?raw`) and installs it once per document at import time, alongside custom-element registration, so it is in place before any instance renders. The separately importable session-debugger entry installs it too. The orphaned `dist/assets/pie-item-player.css` is no longer emitted. `@pie-players/pie-section-player` and `@pie-players/pie-assessment-player` are covered transitively, since they render items through the item player.

  The stylesheet is prepended to `<head>` and deliberately left unlayered, so host CSS that loads later still wins at equal specificity — the placement hosts were previously told to arrange by hand. A cascade layer would have been wrong here: unlayered author declarations beat all layered ones regardless of specificity, so a host reset as broad as `p { margin: 0 }` would have silently outranked `.numbered-paragraph { margin-left: 36px }`.

  Hosts that want to own the stylesheet can set `<html data-pie-content-styles="host">` before the player script runs; the player then installs nothing and warns once if no content stylesheet turns out to be present. `components.css` declares `--pie-content-styles` on `:root` as the presence sentinel behind that check.

  Upgrading hosts do not have to remove an existing `import "@pie-players/pie-theme/components.css"` for this release to be correct: installation is idempotent, and two matching copies render identically. But a host copy loads later than the installed one and therefore wins ties at equal specificity, so a host copy pinned to an older `@pie-players/pie-theme` would silently override newer player rules. Rather than leave that to be discovered, the players now log a one-time warning naming the redundant import when they detect a second copy in the document.

  `@pie-players/pie-print-player` installs it the same way, from its `src/index.ts` entry. This player never told hosts to import the stylesheet at all, so it had no working route to these styles. The gap is worse than a cosmetic one here: `components.css` owns `@media print { .noprint, .kds-noprint { display: none } }`, so a missing copy did not just render authored passage markup unstyled — it printed content the author had marked as non-printing. Nothing in the package strips authored classes on the way through; `processMarkup` swaps only the interactive element tags and returns the surrounding markup verbatim, and `pie-print` renders into light DOM (`createRenderRoot()` returns `this`), so a document-level stylesheet is the only thing that can reach that content.

  New in `@pie-players/pie-players-shared`: `installContentStyles`, `contentStylesPresent`, `contentStylesOptedOut`, `auditContentStyles`, plus a narrow `@pie-players/pie-players-shared/ui/content-styles` export. Print player imports through that subpath rather than the package root, because players-shared declares `sideEffects: true` and print player externalizes nothing — the root barrel would have bundled all of players-shared into `print-player.js`.

  Hosts that already import `@pie-players/pie-theme/components.css` need no change — installation is idempotent and a duplicate host copy simply wins on document order.

- 6a18f3c: Scope external stylesheets with an at-rule-aware walker, so `@media`, `@supports` and `:root` survive.

  `pie-item-player` scoped external stylesheets by prefixing every selector-like fragment with
  one regex. That is correct for flat selector rules and wrong for everything else:
  `@media screen { ... }` became `.pie-item-player.x @media screen { ... }`, an invalid
  selector, so the browser dropped the whole block and every rule inside it. `@font-face` and
  `@keyframes` were corrupted the same way — the font never loaded, the animation name was
  gone. And `:root { --var: ... }` became `.pie-item-player.x :root`, which can never match,
  because `:root` is `<html>` and is not a descendant of the player.

  At-rules and `:root` custom properties therefore never applied at all. Both entry paths were
  affected: the `external-style-urls` attribute and `itemConfig.resources.stylesheets[*].url`.

  Scoping now walks the stylesheet brace-by-brace, in a new `scopeStylesheetCss` export from
  `@pie-players/pie-players-shared`:

  - `@media`, `@supports`, `@container`, `@layer` and `@scope` keep their prelude and have
    their inner rules scoped, recursively.
  - `@font-face`, `@keyframes` (including vendor-prefixed), `@page`, `@property` and
    `@counter-style` pass through untouched, as do at-rules the walker does not recognise —
    their blocks hold declarations or keyframe selectors, not selectors to scope.
  - `:root`, `html` and `body` are replaced by the scope selector instead of being prefixed by
    it, so external custom properties apply. Anything that followed is preserved:
    `html.dark .a` becomes `.pie-item-player.x.dark .a`.
  - A leading pseudo becomes a descendant: `:is(.a, .b) .c` scopes to
    `.pie-item-player.x :is(.a, .b) .c`, not `.pie-item-player.x:is(.a, .b) .c`, which would
    demand that the player root carry the partner's class.
  - Parsing is string- and paren-aware, so a `{` inside `content: "{"` does not end a block and
    a `,` inside `:is(a, b)` does not split a selector list. Comments are stripped before the
    walk so one sitting between two rules is not absorbed into the next selector.
  - Style-rule blocks are emitted verbatim, which is also what native CSS nesting needs:
    nested selectors are relative to a parent that has already been scoped.

  Flat selector rules scope exactly as before. No new dependency, and no public API change —
  no new attribute, prop or event.

  **Where stylesheets are passed, expect visible changes.** At-rules and `:root` variables have
  never applied in this player, so fixing the scoper turns currently-dead CSS live. That is the
  point of the fix, but it is a real rendering difference for any host that was passing a
  stylesheet with media queries or custom properties in it.

  `@import` still passes through untouched, exactly as the regex left it. It pulls in an
  unscoped stylesheet and so defeats scoping; blocking it is a policy decision, not a scoping
  one. Cross-origin stylesheets are also still unscoped — they take the `<link>` branch because
  `fetch()` cannot read the text to rewrite. Both are pre-existing and tracked separately.

- Updated dependencies [c73c995]
- Updated dependencies [c73c995]
- Updated dependencies [14666b3]
- Updated dependencies [99929d8]
- Updated dependencies [001486e]
- Updated dependencies [6a18f3c]
- Updated dependencies [c810459]
  - @pie-players/pie-theme@0.3.62
  - @pie-players/pie-players-shared@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-players-shared@0.3.61
- @pie-players/pie-theme@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-players-shared@0.3.60
- @pie-players/pie-theme@0.3.60

## 0.3.59

### Patch Changes

- @pie-players/pie-players-shared@0.3.59
- @pie-players/pie-theme@0.3.59

## 0.3.58

### Patch Changes

- 8df52bf: Add an opt-in allow-list for executable element packages. The default policy mode requires exact versions without build metadata so legacy IIFE bundle separators cannot be injected. Existing hosts that omit the policy retain their current loading behavior.
- Updated dependencies [8df52bf]
- Updated dependencies [d5cc905]
  - @pie-players/pie-players-shared@0.3.58
  - @pie-players/pie-theme@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.57
  - @pie-players/pie-theme@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.56
  - @pie-players/pie-theme@0.3.56

## 0.3.55

### Patch Changes

- 7f45877: Forward metadata-only item session changes when renderer snapshots leave response data unchanged, without reclassifying those echoes as response data.
- Updated dependencies [7f45877]
  - @pie-players/pie-players-shared@0.3.55
  - @pie-players/pie-theme@0.3.55

## 0.3.54

### Patch Changes

- 1748ed5: Add namespaced backend delivery and authoring support, including server-backed model refresh, authoring load/save/release and media hooks, and indirect section/assessment runtime configuration for item backends.
  - @pie-players/pie-players-shared@0.3.54
  - @pie-players/pie-theme@0.3.54

## 0.3.53

### Patch Changes

- Updated dependencies [ee6c081]
  - @pie-players/pie-theme@0.3.53
  - @pie-players/pie-players-shared@0.3.53

## 0.3.52

### Patch Changes

- Updated dependencies [017f5a9]
  - @pie-players/pie-players-shared@0.3.52
  - @pie-players/pie-theme@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.51
  - @pie-players/pie-theme@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.50
  - @pie-players/pie-theme@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.49
  - @pie-players/pie-theme@0.3.49

## 0.3.48

### Patch Changes

- 0c20d0f: Fix PIE-631: EBSR (and any element with `lockChoiceOrder: false`) no longer triggers an infinite render loop. A controller's persisted derived state (e.g. shuffled choice order) now round-trips back into the authoritative item session via a new `ItemController.mergeElementSession` and an `onElementSessionUpdate` callback on `updatePieElements`, so the order is reused across renders instead of being regenerated non-deterministically each cycle.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0c20d0f]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.48
  - @pie-players/pie-theme@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.47
  - @pie-players/pie-theme@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.46
  - @pie-players/pie-theme@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.45
  - @pie-players/pie-theme@0.3.45

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.44
  - @pie-players/pie-theme@0.3.44

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.42
  - @pie-players/pie-theme@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.41
  - @pie-players/pie-theme@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [3a167a8]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.40
  - @pie-players/pie-theme@0.3.40

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0072fad]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.39
  - @pie-players/pie-theme@0.3.39

## 0.3.38

### Patch Changes

- c8d46d7: Remove PIE-owned focus-placement APIs and automatic section navigation focus movement.

  This is a breaking cleanup for pre-1.0 hosts: `pie-item-player.focusFirst()`, section-player layout `focusStart()`, `SectionPlayerFocusPolicy.autoFocus`, `DEFAULT_FOCUS_POLICY`, and `resolveAutoFocusStrategy` are no longer exported. The shared `queryFirstFocusableDeep()` and `focusFirstFocusableInElement()` helpers were also removed; `FOCUSABLE_SELECTOR` and `isProgrammaticFocusTarget()` remain for focus-trap internals.

  Hosts should own skip links, landmarks, and page-level focus placement while section player preserves natural tab order into actionable controls.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [f856362]
- Updated dependencies [c8d46d7]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.38
  - @pie-players/pie-theme@0.3.38

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.37
  - @pie-players/pie-theme@0.3.37

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.36
  - @pie-players/pie-theme@0.3.36

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.35
  - @pie-players/pie-theme@0.3.35

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.34
  - @pie-players/pie-theme@0.3.34

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.33
  - @pie-players/pie-theme@0.3.33

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.32
  - @pie-players/pie-theme@0.3.32

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [26dbea3]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.31
  - @pie-players/pie-theme@0.3.31

## 0.3.30

### Patch Changes

- 698aa82: Add `focusFirst()` to `pie-item-player` and nest it after section navigation focuses the current item card.

  - Export `queryFirstFocusableDeep`, `focusFirstFocusableInElement`, `isProgrammaticFocusTarget`, and `FOCUSABLE_SELECTOR` from `@pie-players/pie-players-shared` (deep traversal into **open** shadow roots; same selector basis as the focus trap).
  - `pie-item-player.focusFirst()` moves focus to the first visible interactive control inside the item.
  - Section player scaffold calls `focusFirst()` after programmatic focus lands on an item card (`start-of-content` without passage, and `current-item`).

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0981bc3]
- Updated dependencies [698aa82]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.30
  - @pie-players/pie-theme@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.29
  - @pie-players/pie-theme@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.28
  - @pie-players/pie-theme@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.27
  - @pie-players/pie-theme@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.26
  - @pie-players/pie-theme@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.25
  - @pie-players/pie-theme@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.25
  - @pie-players/pie-theme@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.24
  - @pie-players/pie-theme@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.23
  - @pie-players/pie-theme@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.22
  - @pie-players/pie-theme@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.21
  - @pie-players/pie-theme@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.20
  - @pie-players/pie-theme@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.19
  - @pie-players/pie-theme@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.18
  - @pie-players/pie-theme@0.3.18

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.17
  - @pie-players/pie-theme@0.3.17

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.16
  - @pie-players/pie-theme@0.3.16

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.15
  - @pie-players/pie-theme@0.3.15

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.14
  - @pie-players/pie-theme@0.3.14

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.13
  - @pie-players/pie-theme@0.3.13

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.12
  - @pie-players/pie-theme@0.3.12

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.11
  - @pie-players/pie-theme@0.3.11

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.10
  - @pie-players/pie-theme@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.9
  - @pie-players/pie-theme@0.3.9

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.10
  - @pie-players/pie-theme@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.9
  - @pie-players/pie-theme@0.3.9

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.8
  - @pie-players/pie-theme@0.3.8

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.7
  - @pie-players/pie-theme@0.3.7

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.6
  - @pie-players/pie-theme@0.3.6

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.5
  - @pie-players/pie-theme@0.3.5

## 0.3.4

### Patch Changes

- @pie-players/pie-players-shared@0.3.4
- @pie-players/pie-theme@0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.3
  - @pie-players/pie-theme@0.3.3

## 0.3.2

### Patch Changes

- @pie-players/pie-players-shared@0.3.2
- @pie-players/pie-theme@0.3.2

## 0.3.1

### Patch Changes

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
  - @pie-players/pie-players-shared@0.3.0
  - @pie-players/pie-theme@0.3.0

## 0.1.1

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/pie-players-shared@0.2.6
  - @pie-players/pie-theme@0.1.2
