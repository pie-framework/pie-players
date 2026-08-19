# @pie-players/pie-tool-annotation-toolbar

## 0.3.69

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.69
  - @pie-players/pie-players-shared@0.3.69

## 0.3.68

### Patch Changes

- 5a41616: Trigger the annotation toolbar from the selection itself, and give its
  `role="toolbar"` the key model that role promises.
  
  The toolbar was shown from `mouseup` and `touchend` only. A selection that arrived
  any other way produced nothing, so highlight, underline, remove-annotation and
  read-aloud-selection had no keyboard route at all — WCAG 2.2 SC 2.1.1. The strip
  also declared `role="toolbar"` while leaving every button its own tab stop, so the
  arrow keys the role advertises did nothing and the control set cost as many tab
  stops as it had buttons.
  
  `selectionchange` is now the trigger, coalesced per animation frame. Pointer
  gestures suppress the show between `pointerdown` and release, so dragging a
  selection no longer drags a toolbar across the text mid-gesture; the suppression is
  a bounded timestamp rather than a latch, because a release outside the window fires
  no `pointerup` and a latch would disable the toolbar for the rest of the attempt.
  `pointercancel` is handled for the same reason. Scrolling repositions the strip
  instead of dismissing it — the previous behaviour dismissed on the very keystroke
  that scrolled a selection into view — and withdraws it only once the selection's
  rect leaves the viewport entirely.
  
  The strip is now a single tab stop with a roving tabindex over whatever controls are
  rendered, which is conditional: read-aloud is absent without a TTS service and
  remove-annotation exists only over an existing annotation. Arrow keys are logical
  rather than physical, so they run in reading order for `ar`. `Shift+F10` and the
  Menu key move focus into the strip, matching the platform convention for a
  context-sensitive affordance, because the strip is a floating layer whose DOM
  position bears no relation to the selection. Escape returns focus where it was and
  leaves the selection intact. Outside-click dismissal reads `composedPath()`, since a
  document-level listener sees the retargeted host and `contains` reported false for
  the strip's own buttons — dismissing on the click that was activating one.
  
  One limit this does not remove, and cannot: Chromium does not extend a selection
  with Shift+Arrow in non-editable content unless caret browsing is on, an OS-level
  toggle absent on mobile. Screen reader users reach the toolbar, because JAWS and
  NVDA set a real DOM selection in browse mode and `selectionchange` observes it, and
  pointer and touch users are unaffected. A sighted keyboard-only user still cannot
  originate the selection. Any capability offered *only* through this strip is
  therefore unreachable for them and needs a second entry point.
  
  Covered by `packages/tool-annotation-toolbar/tests/selection-keyboard.test.ts` for
  the navigation, bounds and gesture-suppression logic, and by
  `packages/section-player/tests/section-annotation-toolbar-keyboard.spec.ts` for the
  browser behaviour that only a browser can settle — `selectionchange` timing, focus
  crossing into a shadow root, and the roving tabindex. `section-player-tts-ssml.spec.ts`
  no longer dispatches a synthetic `mouseup` to get the strip on screen; that it
  needed one was the defect.
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
- 0dc9c96: Selecting a word now offers a dictionary lookup on the annotation strip, and the panel opens already answered.
  
  The mechanism is a capability-agnostic one, because a selection gateway cannot name the tool it opens. `ToolkitCoordinator` gains `requestTool` / `canRequestTool` / `registerToolRequestTarget`: a surface names an unscoped tool id, and the toolbar hosting that tool turns it into a scoped instance, applies the request's params and shows it. Resolution is a claim rather than a broadcast — a broadcast would open a panel in every toolbar whose scope contains the selection, which in a section player is the item card's and the section's both. Params layer over the host's own, so a request carrying a term leaves a configured endpoint in place, and they arrive through `getToolRenderParams`, which means a tool needs nothing new to receive one.
  
  The strip renders host-supplied `selectionActions` and knows nothing about what they do; the pairing to the two dictionaries lives in the composition layer, which is the only layer allowed to name capabilities. A host can contribute an action for a capability PIE does not ship. An action whose tool no toolbar hosts is absent rather than present and inert.
  
  Acting on a selection now latches the strip down for that selection. The selection itself survives on purpose — the learner's place in the text is not ours to clear — and opening a panel moves focus, which fires `selectionchange`: without the latch the strip came straight back over the definition it had just fetched. Escape, focus leaving and an outside click do not latch, and Shift+F10 clears one, so dismissing never costs a learner the strip for good.
  
  The door is a shortcut, not the way in. Chromium will not extend a selection with Shift+Arrow in non-editable content unless caret browsing is on, an OS toggle absent on mobile, so a sighted keyboard-only learner cannot originate a selection at all. Both dictionaries keep their toolbar button and their own term field.
  
  Fixes both dictionary toolbar buttons rendering blank: `book-open` and `photo` had no entry in the toolbar's icon map, so an icon-only button drew nothing. The map moves to `services/tool-icons.ts` and is exported through `tools/internal`, so a gateway button and the toolbar button for one tool draw the same shape.
- 2d680c8: The selection strip no longer places its own controls off screen.
  
  `toolbarAnchor` returned the selection's horizontal centre and the stylesheet shifted the strip by half a width and a full height. Nothing clamped the result, and nothing kept the arithmetic and the transform agreed — so clamping was not expressible at all. Measured against a passage in the split-pane layout: a selection starting 25px from the viewport edge placed a 353px strip at `x ≈ -109`, putting its first highlight swatches where no pointer can reach them. The vertical case is the more common one, because extending a selection past the fold scrolls it to the top of the viewport.
  
  The anchor now returns the strip's top-left, clamped inside a 4px margin on every edge, and there is no transform to undo it. It flips below the selection only when the strip genuinely does not fit above — above is the preference, since it keeps the strip clear of the text being read — and clamps rather than flipping into a second overflow when neither side fits. A strip wider than the viewport pins to the leading edge, where its first control is.
  
  Placement needs the rendered size, so the first pass places an unmeasured strip and an effect corrects it in the same frame; that correction is what makes the clamp active on the pass that can actually push a control off screen.
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

## 0.3.67

### Patch Changes

- Updated dependencies [b264ab2]
- Updated dependencies [fe9b4f0]
- Updated dependencies [61d6aa0]
  - @pie-players/pie-players-shared@0.3.67
  - @pie-players/pie-assessment-toolkit@0.3.67

## 0.3.66

### Patch Changes

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

## 0.3.63

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.63
- @pie-players/pie-players-shared@0.3.63

## 0.3.62

### Patch Changes

- c73c995: Give the annotation toolbar outline and the annotation underline their own contrast-checked tokens, so neither depends on a token that cannot satisfy WCAG 2.2 SC 1.4.11.

  ## Toolbar outline

  The floating toolbar's stroke is the only boundary between it and the content
  behind it, so it has to clear 3:1 against both. It was derived from
  `--pie-border`, which cannot carry that: the DaisyUI bridge maps that token to
  `--color-base-300`, a surface tint rather than a boundary colour — `#eeeeee` at
  1.16:1 on the light base, `#15191e` at 1.12:1 on the dark one.

  The outline now reads a new `--pie-tool-annotation-toolbar-border`, defaulting to
  a measured `light-dark(#5c5c5c, #949494)` pair — dark grey on light surfaces,
  light grey on dark ones.

  Both arms are measured against the surfaces the toolbar is actually drawn on
  rather than against pure white and pure black. Real theme bases are off-white and
  off-black, and a grey chosen at the edge of passing against an extreme drops under
  threshold on everything else: across DaisyUI's 21 light and 14 dark themes, every
  light surface needs a grey no lighter than `#828282` and every dark surface one no
  darker than `#878787`. Those ranges are disjoint, so one value cannot serve both
  and `light-dark()` is the mechanism. `#5c5c5c` holds 5.22:1 as its worst case on
  the light surfaces and `#949494` holds 3.56:1 on the dark ones.

  `@pie-players/pie-theme` then hands the last word back to palettes that do choose
  a boundary colour deliberately:

  - `[data-theme="dark"]` and `pie-theme[theme="dark"]` pin the dark arm,
    `#949494`. `light-dark()` keys off the declared `color-scheme`, which pie-theme
    does not set, so without this a pie-theme dark page would take the light arm.
  - All ten `data-color-scheme` accessibility palettes map the outline to their own
    `--pie-border`, which each picks for maximum contrast against its own
    background. This rule sits after the dark rule deliberately — the two have
    equal specificity and a scheme can be active on a dark page. The schemes are
    named rather than matched with a bare `[data-color-scheme]`, so an unknown id
    cannot pull in the `:root` values (`--pie-border` is `#9a9a9a`, which misses 3:1
    on white).

  - Each palette also fixes which underline value applies. The underline default is
    selected by `[data-theme]`, which reports what the _page_ declares rather than
    which scheme is active — so a host declaring itself light while running a dark
    scheme pinned the light value over a dark background.

    The colours themselves were never the problem, so they are unchanged: `#4221d5`
    and `#9c89ec` clear 3:1 between them on nine of the ten backgrounds, and each
    scheme is simply given the arm that suits its own. Both states get that one
    value, because within a scheme the background is fixed regardless of what
    `data-theme` reports. Worst case is 4.33:1 (`light-gray-on-dark-gray`).

    `yellow-on-navy` is the sole exception: its `#33508a` background is mid-tone and
    neither arm reaches 3:1 (1.10 light, 2.71 dark), so there alone the underline
    defers to the palette's own `--pie-primary` (`#ffff99`, 7.54:1) — the same
    deference the outline makes to `--pie-border`.

    All three tokens are declared in both delivery routes: per scheme in
    `color-schemes.ts`, so `<pie-theme scheme="…">` applies them as inline styles
    with no CSS import, and in `color-schemes.css` for hosts that set
    `data-color-scheme` themselves.

  `--pie-tool-annotation-toolbar-border` is registered as a `component-public`
  token. Hosts overriding it must keep 3:1 against both the toolbar surface and the
  content behind it.

  ## Annotation underline

  `::highlight(annotation-underline)` took its colour from `--pie-primary`, a theme
  accent chosen against one background and therefore illegible on the other. It now
  reads `--pie-annotation-underline` (default `#4221d5`) and
  `--pie-annotation-underline-dark` (default `#9c89ec`). One value cannot serve
  both: `#4221d5` is 2.41:1 on black and `#9c89ec` is 2.85:1 on white. Each state
  gets its own token so overriding one never silently moves the other, and so
  either can beat a host-set `--pie-primary` — a `var()` fallback can never
  override a value the host actually set.

  The `prefers-color-scheme` media query only reports the OS preference, which is a
  guess at what the page is showing. Three mutually exclusive `[data-theme]` rules
  now override it: explicit `light` and `dark` take the matching default, and any
  other value — including DaisyUI theme ids — follows that theme's accent, falling
  back to the light default. All three carry attribute selectors, so they outrank
  the bare rules including the one inside the media query, whatever the source
  order.

  ## Upgrade note

  Two host overrides stop having their old effect, which is the point of the change
  rather than a side effect of it:

  - Setting `--pie-border` no longer recolours the annotation toolbar outline; set
    `--pie-tool-annotation-toolbar-border`.
  - Setting `--pie-primary` no longer recolours the annotation underline; set
    `--pie-annotation-underline` and `--pie-annotation-underline-dark`. A host that
    declares `data-theme` with neither token set still follows its accent.

- 507b56f: Restore dark-mode, high-contrast, print, and reduced-motion styling for TTS and annotation highlights.

  `HighlightCoordinator` injects the `::highlight()` rules for TTS read-along and
  student annotations. A second copy of those rules also existed as
  `packages/tool-annotation-toolbar/highlights.css`, imported with a plain CSS
  import that never reached the page: the package builds with Vite in library
  mode, so the import was extracted to a `dist` stylesheet the built JS never
  referenced and no `exports` entry exposed.

  The two copies had diverged in both directions. The injected copy had gained
  newer TTS work (`--pie-tts-line-highlight`, element-level fallbacks, an orange
  swatch) while never having the media-query blocks the file carried. So at runtime
  annotation highlights had no dark-mode or high-contrast treatment, printing did
  not strip transient TTS highlighting or convert annotation fills to underlines,
  and reduced-motion did not drop highlight text shadows.

  Those blocks now live with the rules they modify, covering all five annotation
  swatches including orange. Two corrections were made rather than copying the old
  file forward:

  - The recovered stylesheet used `@media (prefers-contrast: high)`. `high` is not
    a valid value for that feature (the keywords are `no-preference`, `more`,
    `less`, `custom`), so an invalid query evaluates to `not all` and the block
    could never have matched in any browser even had the file loaded. It is now
    `more`.
  - The TTS dark-mode and high-contrast blocks were dropped rather than restored.
    They varied only a `var()` fallback, and `applyAdaptiveTTSStyle()` writes
    `--pie-tts-*` inline on `documentElement` on every paint, so those fallbacks
    can never apply. TTS contrast adaptation is handled by that adaptive path.

  `highlights.css` and its dead import are removed. Its `.pie-sr-only` and
  focus-visible rules were already defined in the toolbar component's own `<style>`
  block, where they do take effect.

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

## 0.3.61

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.61
- @pie-players/pie-players-shared@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.60
- @pie-players/pie-players-shared@0.3.60

## 0.3.59

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.59
  - @pie-players/pie-players-shared@0.3.59

## 0.3.58

### Patch Changes

- Updated dependencies [8df52bf]
- Updated dependencies [d5cc905]
  - @pie-players/pie-players-shared@0.3.58
  - @pie-players/pie-assessment-toolkit@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.57
  - @pie-players/pie-players-shared@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.56
  - @pie-players/pie-players-shared@0.3.56

## 0.3.55

### Patch Changes

- Updated dependencies [7f45877]
  - @pie-players/pie-players-shared@0.3.55
  - @pie-players/pie-assessment-toolkit@0.3.55

## 0.3.54

### Patch Changes

- Updated dependencies [bead424]
  - @pie-players/pie-assessment-toolkit@0.3.54
  - @pie-players/pie-players-shared@0.3.54

## 0.3.53

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.53
- @pie-players/pie-players-shared@0.3.53

## 0.3.52

### Patch Changes

- Updated dependencies [905080d]
- Updated dependencies [017f5a9]
  - @pie-players/pie-assessment-toolkit@0.3.52
  - @pie-players/pie-players-shared@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.51
  - @pie-players/pie-players-shared@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.50
  - @pie-players/pie-players-shared@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.49
  - @pie-players/pie-players-shared@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0c20d0f]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.48
  - @pie-players/pie-assessment-toolkit@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.47
  - @pie-players/pie-players-shared@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.46
  - @pie-players/pie-players-shared@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies [fd140a3]
  - @pie-players/pie-assessment-toolkit@0.3.45
  - @pie-players/pie-players-shared@0.3.45

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.44
  - @pie-players/pie-players-shared@0.3.44

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [6496dda]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.42
  - @pie-players/pie-players-shared@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.41
  - @pie-players/pie-players-shared@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [3a167a8]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.40
  - @pie-players/pie-assessment-toolkit@0.3.40

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0072fad]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.39
  - @pie-players/pie-players-shared@0.3.39

## 0.3.38

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [f856362]
- Updated dependencies [ef29724]
- Updated dependencies [c8d46d7]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.38
  - @pie-players/pie-assessment-toolkit@0.3.38

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [2818f93]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.37
  - @pie-players/pie-players-shared@0.3.37

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [9ef211c]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.36
  - @pie-players/pie-players-shared@0.3.36

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [286418e]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.35
  - @pie-players/pie-players-shared@0.3.35

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [af850c0]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.34
  - @pie-players/pie-players-shared@0.3.34

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [70612af]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.33
  - @pie-players/pie-players-shared@0.3.33

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0355143]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.32
  - @pie-players/pie-players-shared@0.3.32

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [26dbea3]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.31
  - @pie-players/pie-players-shared@0.3.31

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0981bc3]
- Updated dependencies [698aa82]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.30
  - @pie-players/pie-assessment-toolkit@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.29
  - @pie-players/pie-players-shared@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.28
  - @pie-players/pie-players-shared@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.27
  - @pie-players/pie-players-shared@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.26
  - @pie-players/pie-players-shared@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.25
  - @pie-players/pie-players-shared@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.25
  - @pie-players/pie-players-shared@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.24
  - @pie-players/pie-players-shared@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.23
  - @pie-players/pie-players-shared@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.22
  - @pie-players/pie-players-shared@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.21
  - @pie-players/pie-players-shared@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.20
  - @pie-players/pie-players-shared@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.19
  - @pie-players/pie-players-shared@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.18
  - @pie-players/pie-players-shared@0.3.18

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.17
  - @pie-players/pie-players-shared@0.3.17

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.16
  - @pie-players/pie-players-shared@0.3.16

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.15
  - @pie-players/pie-players-shared@0.3.15

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.14
  - @pie-players/pie-players-shared@0.3.14

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.13
  - @pie-players/pie-players-shared@0.3.13

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.12
  - @pie-players/pie-players-shared@0.3.12

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.11
  - @pie-players/pie-players-shared@0.3.11

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.10
  - @pie-players/pie-players-shared@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.9
  - @pie-players/pie-players-shared@0.3.9

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.10
  - @pie-players/pie-players-shared@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.9
  - @pie-players/pie-players-shared@0.3.9

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.8
  - @pie-players/pie-players-shared@0.3.8

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.7
  - @pie-players/pie-players-shared@0.3.7

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.6
  - @pie-players/pie-players-shared@0.3.6

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.5
  - @pie-players/pie-players-shared@0.3.5

## 0.3.4

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.4
  - @pie-players/pie-players-shared@0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.3
  - @pie-players/pie-players-shared@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.2
  - @pie-players/pie-players-shared@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.1
  - @pie-players/pie-players-shared@0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

- Updated dependencies
- Updated dependencies [9385ce0]
  - @pie-players/pie-assessment-toolkit@0.3.0
  - @pie-players/pie-players-shared@0.3.0

## 0.1.10

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/pie-assessment-toolkit@0.2.10
  - @pie-players/pie-players-shared@0.2.6

## 0.1.9

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
- Updated dependencies [71a9581]
  - @pie-players/pie-assessment-toolkit@0.2.9
  - @pie-players/pie-players-shared@0.2.5
