# @pie-players/pie-tool-tts-inline

## 0.3.69

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.69
  - @pie-players/pie-context@0.3.69
  - @pie-players/pie-players-shared@0.3.69

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
- Updated dependencies [2d8ce6a]
- Updated dependencies [27284f8]
- Updated dependencies [e94b097]
- Updated dependencies [67a3d7e]
- Updated dependencies [d68c01b]
- Updated dependencies [3f5e968]
- Updated dependencies [27284f8]
- Updated dependencies [67f286c]
- Updated dependencies [55016b5]
- Updated dependencies [fc71c91]
- Updated dependencies [e94b097]
- Updated dependencies [00b8a71]
- Updated dependencies [6e1e053]
- Updated dependencies [e94b097]
- Updated dependencies [7c9fb28]
- Updated dependencies [979e643]
- Updated dependencies [1d9f2d3]
- Updated dependencies [e94b097]
- Updated dependencies [27284f8]
- Updated dependencies [54742db]
- Updated dependencies [f61c7c7]
- Updated dependencies [0dc9c96]
- Updated dependencies [cb11691]
- Updated dependencies [4f0cb3f]
- Updated dependencies [e94b097]
  - @pie-players/pie-players-shared@0.3.68
  - @pie-players/pie-assessment-toolkit@0.3.68
  - @pie-players/pie-context@0.3.68

## 0.3.67

### Patch Changes

- Updated dependencies [b264ab2]
- Updated dependencies [fe9b4f0]
- Updated dependencies [61d6aa0]
  - @pie-players/pie-players-shared@0.3.67
  - @pie-players/pie-assessment-toolkit@0.3.67
  - @pie-players/pie-context@0.3.67

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
- 5e6fcde: Make accessibility catalog ownership one resolver contract.

  Mounted items and passages now register all entity-root, extracted, and model
  catalogs through one owner transaction. Content surfaces observe a bound owner
  view and give capabilities an immutable, deterministic catalog snapshot instead
  of exposing the raw entity, resolver, and separately assembled owner context.
  Signing and transcript capabilities now own only their card interpretation.

  Capability authors should read `ToolContentDependencyContext.catalogs` and no
  longer use the removed catalog-collection exports. Direct resolver clients,
  including inline TTS, retain `getAlternative(...)` and
  `catalogOwnerContextFor(...)`. Existing catalog IDs, card and payload shapes,
  `data-catalog-idref`, scoped lookup precedence, TTS fallback behavior, and
  section-player custom-element contracts are unchanged. Invalid optional catalog
  data remains recoverable: it is warned about and omitted without blocking the
  primary assessment content.

- 2bcd9fa: Bridge the vendored NDS icon button's palette to the PIE token families.

  `nds-icon-button` paints from the NDS design-system names — `--color-new-gray`,
  `--color-primary-white`, `--color-primary-black`, `--color-focus-blue` — and no
  PIE theme sets any of them, so the vendored literals were what every host
  rendered: a `#f3f5f7` tertiary pill and a `#2b87ff` focus ring under every theme.
  Remapping only the glyph made the dark-theme case worse, since a light
  `base-content` glyph then sat on that near-white pill and disappeared. Every host
  that opts into `nds-icons` saw it: the calculator button, the inline-TTS trigger,
  the items-pane scroll-down control and the floating tool shell's window controls.

  The tertiary fill now resolves through `--pie-background-dark`, the on-accent
  glyph through `--pie-white`, the hover ring through `--pie-text` and the focus
  ring through `--pie-button-focus-outline`, each keeping the NDS literal as the
  no-theme last resort. Glyph-on-pill measures 14.3:1 under `dracula`, 16.7:1 under
  `light`, 17.3:1 under `pastel` and 4.9:1 under `valentine`; the light theme is
  visually unchanged, since `--pie-background-dark` resolves to `#ecedf1` against
  the `#f3f5f7` it replaces.

  The bridge is declared at each element that mounts a button rather than in one
  stylesheet: the vendored bundle is a build artifact we do not re-author, and two
  of the mounts sit inside a shadow root a document stylesheet cannot reach. The
  tool shell's window controls are created imperatively, so the shell element
  carries the properties directly — its scoped CSS never matches them.
  `check:theme-tokens` now fails if a mount is added without the bridge or if the
  copies drift.

- 2a741c6: Paint the inline TTS overlay panel from the active theme instead of the Figma
  literals.

  The floating and left-aligned panels hardcoded their palette: `#146eb3` media
  glyphs and selected-speed text, a `#fff` card, a `#f3f5f7` chip with a `#d9dada`
  border, `#5b6b73` unselected labels. Only host-scoped hooks nobody sets stood in
  front of those values, so the panel ignored the theme entirely — a DaisyUI
  `valentine` page rendered a pink player with a blue TTS panel floating over it,
  and every dark theme got the same white card. Each surface now resolves its hook
  first, then a canonical token, then the literal as the no-theme last resort. The
  NDS trigger glyph, which remapped `--color-interactive-blue` to the same accent,
  follows the same chain.

  Foregrounds default through `--pie-button-color` rather than an accent token.
  `--pie-primary` and `--pie-tertiary` are `direct` mappings of DaisyUI slots
  chosen to pair with their own `-content` colour, so a glyph taken from either
  measures 1.37:1 against the card under `pastel`, and 11 of the 35 shipped themes
  fall under SC 1.4.11's 3:1 — 17 under 1.4.3's 4.5:1 for the selected label.
  Tinting an accent toward the text colour does not rescue it either: even a 20%
  share leaves `valentine` at 4.13:1 on the chip. `base-content` is the one family
  whose contrast against the card DaisyUI guarantees, and the selected-chip fill
  takes `--pie-button-active-bg`, which the mapping already tunes to hold
  `base-content` at 4.5:1. Selection is signalled by the chip and the bolder
  weight rather than by hue; a host that wants a branded accent sets
  `--pie-tts-button-color` and owns the contrast.

  Two consequences of theming the card. Its background resolves through
  `--pie-white`, the theme's opaque page surface, not `--pie-background`, which the
  base light theme sets to `rgba(255,255,255,0)` so page content shows through — a
  floating card cannot be transparent. And the Figma card is shadow-only with a
  black shadow, which leaves no visible edge once the surface goes dark, so the
  card now carries a hairline mixed from `--pie-text` that reads on either, with
  `--pie-tts-card-border` as the opt-out (`transparent` restores the shadow-only
  card). It is not derived from `--pie-border`, since a host that sets that to
  transparent for borderless controls is exactly the host whose only card edge is
  the shadow.

- Updated dependencies [556c422]
- Updated dependencies [2a741c6]
- Updated dependencies [5e6fcde]
- Updated dependencies [2bcd9fa]
- Updated dependencies [2bcd9fa]
- Updated dependencies [2bcd9fa]
- Updated dependencies [1f29de7]
- Updated dependencies [5e6fcde]
- Updated dependencies [5f133be]
- Updated dependencies [9a183cf]
  - @pie-players/pie-assessment-toolkit@0.3.66
  - @pie-players/pie-players-shared@0.3.66
  - @pie-players/pie-context@0.3.66

## 0.3.65

### Patch Changes

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
  - @pie-players/pie-context@0.3.64

## 0.3.63

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.63
- @pie-players/pie-context@0.3.63
- @pie-players/pie-players-shared@0.3.63

## 0.3.62

### Patch Changes

- c810459: Make the documented active/open trigger hooks work again in the inline TTS tool.

  `README.md` documents `--pie-tool-trigger-active-background`, `-color` and
  `-border-color` as the supported way to style the trigger while its panel is
  open, instead of overriding broad tokens such as `--pie-primary`. The component
  referenced none of them, so a host following the documentation got no effect.
  PIE-727 added these hooks for exactly this control; they were lost in a later
  refactor, and the stale registry metadata pointing at this package is what
  surfaced it.

  All three now apply while `aria-expanded="true"`, which the markup already
  maintains.

  Each hook falls back to the value the control already resolves to, so setting
  none of them leaves the trigger looking identical open and closed. That is
  deliberate: unlike the calculator's equivalent hooks, this trigger has never had
  a filled active look — the panel opening is itself the state indication — and
  introducing one would restyle a shipped control for every host. The README
  previously claimed the unset default derived from `--pie-primary`, which had
  never shipped here; it now describes the actual fallbacks.

  Verified in Chromium by comparing the three properties as sRGB bytes rather than
  as computed-style strings, since routing an identical value through one more
  `var()` layer changes the colour space Chromium serialises to. With the hooks
  unset, open matches closed exactly. With them set, all three take effect, and
  they stop applying once `aria-expanded` goes false.

  The token registry regains this package in `definedIn` for the three hooks.

- Fix inline TTS keyboard navigation so the reading controls sit in the page tab order in visual order.

  - The controls panel now precedes the play/pause trigger in the DOM for the overlay layouts (`floating-overlay` and the default `left-aligned`), where it opens to the left of the trigger. Shift+Tab from Play/Pause now walks backwards through stop → fast-forward → rewind → speed controls. The row layouts, which drop the panel below the trigger, keep trigger-then-panel order.
  - Rewind, fast-forward and stop are each their own Tab stop instead of sharing one roving toolbar stop, so every control is reachable with Tab alone.
  - The speed radios remain a single Tab stop, now placed on the _checked_ option per the ARIA radiogroup pattern (previously it was always the first option, e.g. "slow", even when "normal" was selected).
  - Arrowing onto a speed option now selects it immediately, like a native radio group or an answer-choice group — no Spacebar/Enter needed. Arrow keys stay within their cluster, so they never cross the radiogroup boundary, and they skip disabled controls instead of stranding focus.
  - The play/pause trigger keeps keyboard focus when activated. It no longer sets `disabled` while the play action is in flight — a disabled element cannot hold focus, so pressing Play dropped focus to the document body. Re-entrancy is still guarded in the handler and the pending state is exposed via `aria-busy`.
  - Stopping playback hands focus back to the play/pause trigger. Stop unmounts the panel containing the button that was just activated, which previously left focus on `<body>`.
  - The play/pause trigger now paints a focus ring whenever it holds focus, not only when the browser decides `:focus-visible` applies. Because activating it deliberately keeps focus on the trigger while the panel opens beside it, a pointer activation (or the programmatic hand-back from Stop) previously left focus on the trigger with nothing drawn. The rule is scoped to `:focus:not(:focus-visible)`, so genuine keyboard focus keeps the shared control ring — and the `nds-icon-button` variant keeps the NDS ring — unchanged.
  - Stop stays active after reading finishes on its own. Previously it was disabled together with rewind and fast-forward once playback ended, which also meant it lost any keyboard focus it held; it now stays enabled for as long as the panel is open, since it can still halt playback and dismiss the controls.
  - If rewind or fast-forward holds keyboard focus when reading finishes, focus moves to Stop instead of being dropped to the document body when those controls go inactive.

- Updated dependencies [c73c995]
- Updated dependencies [507b56f]
- Updated dependencies [14666b3]
- Updated dependencies [001486e]
- Updated dependencies [6a18f3c]
- Updated dependencies [a1edde5]
- Updated dependencies [7864f66]
- Updated dependencies [3b4e461]
- Updated dependencies [7605500]
  - @pie-players/pie-assessment-toolkit@0.3.62
  - @pie-players/pie-players-shared@0.3.62
  - @pie-players/pie-context@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.61
- @pie-players/pie-context@0.3.61
- @pie-players/pie-players-shared@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.60
- @pie-players/pie-context@0.3.60
- @pie-players/pie-players-shared@0.3.60

## 0.3.59

### Patch Changes

- Add an opt-in `nds-icons` flag so hosts can render the vendored `<nds-icon-button>` per environment. Enable it with the `nds-icons` attribute on a section-player element (`<pie-section-player-splitpane nds-icons={true}>`, and likewise on `-vertical`, `-tabbed`, and `-base`) or via `runtime.ndsIcons: true`. When on, the toolbar tool buttons, the calculator shell controls, the inline-TTS play/pause trigger, and the section scroll-hint render as NDS icon buttons; the flag flows through the toolkit runtime context. It defaults to off, so unless a host explicitly opts in these controls render as plain `<button>`s.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.59
  - @pie-players/pie-context@0.3.59
  - @pie-players/pie-players-shared@0.3.59

## 0.3.58

### Patch Changes

- Updated dependencies [8df52bf]
- Updated dependencies [d5cc905]
  - @pie-players/pie-players-shared@0.3.58
  - @pie-players/pie-assessment-toolkit@0.3.58
  - @pie-players/pie-context@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.57
  - @pie-players/pie-context@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.56
  - @pie-players/pie-context@0.3.56

## 0.3.55

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.55
- @pie-players/pie-context@0.3.55

## 0.3.54

### Patch Changes

- bead424: Make inline TTS speed controls a single-select radio-style group with visible Normal selected by default, while preserving host ordering and numeric helper compatibility.
- Updated dependencies [bead424]
  - @pie-players/pie-assessment-toolkit@0.3.54
  - @pie-players/pie-context@0.3.54

## 0.3.53

### Patch Changes

- ee6c081: Add the initial PIE theme token registry contract, source-usage gate, theme parity checks, compatibility fallback chains, and broad theming accessibility planning artifacts for safer host theme overrides.
- 20fc985: Add component-scoped active/open inline tool trigger theme hooks so hosts can style TTS and calculator trigger states without overriding broad semantic tokens.
  - @pie-players/pie-assessment-toolkit@0.3.53
  - @pie-players/pie-context@0.3.53

## 0.3.52

### Patch Changes

- 905080d: Add a runtime TTS highlight target resolver so hosts can remap spoken ranges to visible highlight targets while PIE Players keeps default identity highlighting, painting, and cleanup.
- Updated dependencies [905080d]
  - @pie-players/pie-assessment-toolkit@0.3.52
  - @pie-players/pie-context@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.51
  - @pie-players/pie-context@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.50
  - @pie-players/pie-context@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.49
  - @pie-players/pie-context@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.48
  - @pie-players/pie-context@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.47
  - @pie-players/pie-context@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.46
  - @pie-players/pie-context@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies [fd140a3]
  - @pie-players/pie-assessment-toolkit@0.3.45
  - @pie-players/pie-context@0.3.45

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.44
  - @pie-players/pie-context@0.3.44

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [6496dda]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.42
  - @pie-players/pie-context@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.41
  - @pie-players/pie-context@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.40
  - @pie-players/pie-context@0.3.40

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0072fad]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.39
  - @pie-players/pie-context@0.3.39

## 0.3.38

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [ef29724]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.38
  - @pie-players/pie-context@0.3.38

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [2818f93]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.37
  - @pie-players/pie-context@0.3.37

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [9ef211c]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.36
  - @pie-players/pie-context@0.3.36

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [286418e]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.35
  - @pie-players/pie-context@0.3.35

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [af850c0]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.34
  - @pie-players/pie-context@0.3.34

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [70612af]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.33
  - @pie-players/pie-context@0.3.33

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0355143]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.32
  - @pie-players/pie-context@0.3.32

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [26dbea3]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.31
  - @pie-players/pie-context@0.3.31

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.30
  - @pie-players/pie-context@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.29
  - @pie-players/pie-context@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.28
  - @pie-players/pie-context@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.27
  - @pie-players/pie-context@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.26
  - @pie-players/pie-context@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.25
  - @pie-players/pie-context@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.25
  - @pie-players/pie-context@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.24
  - @pie-players/pie-context@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.23
  - @pie-players/pie-context@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.22
  - @pie-players/pie-context@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.21
  - @pie-players/pie-context@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.20
  - @pie-players/pie-context@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.19
  - @pie-players/pie-context@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.18
  - @pie-players/pie-context@0.3.18

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.17
  - @pie-players/pie-context@0.3.17

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.16
  - @pie-players/pie-context@0.3.16

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.15
  - @pie-players/pie-context@0.3.15

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.14
  - @pie-players/pie-context@0.3.14

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.13
  - @pie-players/pie-context@0.3.13

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.12
  - @pie-players/pie-context@0.3.12

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.11
  - @pie-players/pie-context@0.3.11

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.10
  - @pie-players/pie-context@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.9
  - @pie-players/pie-context@0.3.9

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.10
  - @pie-players/pie-context@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.9
  - @pie-players/pie-context@0.3.9

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.8
  - @pie-players/pie-context@0.3.8

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.7
  - @pie-players/pie-context@0.3.7

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.6
  - @pie-players/pie-context@0.3.6

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.5
  - @pie-players/pie-context@0.3.5

## 0.3.4

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.4
  - @pie-players/pie-context@0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.3
  - @pie-players/pie-context@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.2
  - @pie-players/pie-context@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.1
  - @pie-players/pie-context@0.3.1

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

## 0.1.7

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/pie-assessment-toolkit@0.2.10
  - @pie-players/pie-context@0.1.2

## 0.1.6

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
- Updated dependencies [71a9581]
  - @pie-players/pie-assessment-toolkit@0.2.9
  - @pie-players/pie-context@0.1.1
