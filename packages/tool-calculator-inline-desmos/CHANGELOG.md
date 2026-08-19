# @pie-players/pie-tool-calculator-inline

## 0.3.68

### Patch Changes

- 67f286c: Reword sixteen English interface strings that the i18n adoption deliberately
  carried over unchanged, and settle one naming rule for the nine toolbar tool
  buttons.
  
  Adopting the interface locale held English byte-identical on purpose, so that a
  host who opted into nothing saw exactly the chrome they already had and no text
  change hid inside a refactor. That left a set of strings keyed but not fixed. This
  is that follow-up, and it is a text change with nothing else in it.
  
  Most of them are accessible names, which is why they are worth the entry: a screen
  reader reads them aloud, and a host may be asserting the exact string.
  
  - `tools.protractor.toolA11y` no longer ends "Current rotation displayed via
    Moveable.js". A learner does not need the name of the drag library, and the
    clause said nothing about how to use the tool. The keyboard instructions in
    front of it are unchanged apart from `PageUp/PageDown` becoming "PageUp or
    PageDown", which a screen reader reads as words rather than a path.
    `tools.ruler.applicationA11y` carries the same instruction and gets the same
    treatment.
  - `tools.graph.toolA11y`, `tools.graph.canvasA11y` and
    `tools.periodicTable.toolA11y` were Title Case with a hyphen standing in for a
    break ("Graph Tool - Draw points and lines…"). Now sentence case with an em
    dash. The periodic table's also said "Click elements", which excludes keyboard
    and touch, and now reads "select an element to view its details".
  - `tools.textToSpeech.toolA11y` was "Text-to-Speech Tool", now "Text-to-speech
    tool", matching every other `toolA11y`.
  - The four `tools.graph.mode*Hint` strings capitalised the word after the colon
    ("Point: Click on the grid"). Now lowercase, as running text.
  - Five `debug.tts.*` messages spelled the abbreviation "TTS" at a learner. They
    now say "text-to-speech", or drop the word where the surrounding sentence
    already establishes it.
  - `debug.liveUpdatesDisconnected` and `debug.tts.applying` used three ASCII dots
    where `common.loading` uses an ellipsis. Now consistent.
  
  One key pair is removed rather than reworded. `tools.ruler` carried three forms of
  each unit name because the pre-adoption code rendered three: Title Case on the
  button, lowercase in the announcement, and the raw `'inches' | 'cm'` state token in
  the accessible name and the image alt — so the same tool said "inches" for one unit
  and "cm" for the other, in a string a screen reader speaks as two letters. The
  abbreviation pair is gone and both of those now interpolate the spelled-out
  in-sentence form, leaving two forms per unit instead of three.
  
  ## Toolbar button accessible names
  
  Every toolbar tool button is a toggle: the toolbar mirrors its active state onto
  the button as `aria-pressed`. Two of the nine names contradicted that by naming an
  action — "Open ruler tool" announced as "Open ruler tool, toggle button, pressed"
  once the ruler was open. The rest used a `Name - Description` form whose hyphen a
  screen reader renders as an unpredictable pause, and two of them collided outright:
  `tools.highlighter` and `tools.annotationToolbar` both resolved to "Highlight
  text" for different buttons.
  
  All nine now follow one rule. The name contains the button's visible tooltip
  verbatim, per WCAG 2.5.3 Label in Name, and adds a comma-separated purpose clause
  only where the tooltip alone does not identify the tool — so "Ruler" and
  "Protractor" stand alone, while "Theme" becomes "Theme, change colors and
  contrast". No name encodes an action, because the pressed state already carries it.
  `tools.answerEliminator.buttonA11y` previously did not contain its own tooltip
  ("Strike Through") at all, which is the 2.5.3 failure rather than a style
  preference.
  
  `tools.annotationToolbar.tooltip` changes from "Highlight" to "Annotate": two
  toolbar buttons carrying the same *visible* label is a defect, and this tool also
  underlines, removes and clears.
  
  The calculator's name no longer swaps between "Open …" and "Close …" as it opens.
  Three unlocalized strings surfaced while making that change, all of them built by
  splicing a raw type token into an English template, and all of them rendered:
  `Close ${name.toLowerCase()}` as the toolbar button's tooltip, `Close ${type}
  calculator` as the inline calculator's tooltip, and `${type} calculator opened`
  in the inline calculator's live region. All three now resolve from the catalog,
  which gains a name and two announcements for each of the three variants the Desmos
  provider implements — including `graphing`, which the inline element accepts from
  its host and which the old template rendered while the catalog had no key for it —
  and drops the six open/close keys the swap needed.
  
  ## nl-NL
  
  The rewordings above leave it alone: a translation was never obliged to reproduce
  an English flaw, and it already rendered the protractor's help without the
  Moveable.js clause. The button naming rule is not an English matter, so all nine
  Dutch `buttonA11y` values move with their English counterparts, and
  `tools.annotationToolbar.tooltip` becomes "Aantekenen" for the same reason it
  becomes "Annotate". Both catalogs stay complete.
  
  ## Downstream impact
  
  This is the only part of the interface-locale work that changes what a host
  renders with no `locale` supplied. Host A is the affected consumer — it drives
  live delivery with the toolbar placed — and Host R renders the same buttons.
  Neither asserts, styles, nor selects on any of the retired strings, so the
  exposure is screen-reader output only. See `docs/integrations/consumer-api-dependencies.md`.
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
- 76003e2: Fold two pinned accents into the palette when a colour scheme asks for one.
  
  The section player's selected passage/questions pill was a fixed `#1D7375` that no
  scheme could reach. Its own white-on-teal text is legible, but as the mark of which
  tab is selected the fill owes 1.4.11's 3:1 against the track, and it measured
  1.42:1 under Yellow on Navy, 2.26:1 under Light Gray on Dark Gray and 2.80:1 under
  Black on Violet.
  
  The inline calculator's open-state trigger was worse, because there the pinned
  value was the ink: the fill already followed `--pie-primary` while the text stayed
  `white`. On the schemes whose primary is a pale yellow that pairing is about 1:1 —
  1.06:1 under Yellow on Blue, 1.07:1 under White on Black, 1.05:1 under Yellow on
  Navy — so the glyph vanished on three of the palettes chosen for legibility.
  
  Both now use the `--pie-fixed-hue-collapse` mechanism the periodic table
  established: the pinned value is exact at 0%, which is every Base Theme, and at
  100%, which is every scheme, the fill resolves to `--pie-primary` and the ink to
  `--pie-background`. That pairing holds at 5.44:1 or better on every built-in
  scheme, and because the track and the trigger's surroundings paint
  `--pie-background`, the same ratio separates the fill from what it sits on. Mixing
  rather than substituting keeps the ink clear of the light Base Theme's transparent
  `--pie-background`, where a substitution would render it invisible.
  
  Two consequences worth knowing. The calculator's deeper hover fill collapses to
  `--pie-primary` rather than `--pie-primary-dark`, since that darker slot pairs
  with the page colour at 3.56:1 under Light Gray on Dark Gray; under a scheme the
  hover therefore matches the open state and the affordance rests on the border. And
  the host override hooks still win in both components, unchanged.
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

- Updated dependencies [fe9b4f0]
- Updated dependencies [61d6aa0]
  - @pie-players/pie-assessment-toolkit@0.3.67
  - @pie-players/pie-context@0.3.67

## 0.3.66

### Patch Changes

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
- Updated dependencies [2a741c6]
- Updated dependencies [5e6fcde]
- Updated dependencies [2bcd9fa]
- Updated dependencies [2bcd9fa]
- Updated dependencies [5e6fcde]
- Updated dependencies [5f133be]
- Updated dependencies [9a183cf]
  - @pie-players/pie-assessment-toolkit@0.3.66
  - @pie-players/pie-context@0.3.66

## 0.3.65

### Patch Changes

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
  - @pie-players/pie-assessment-toolkit@0.3.65
  - @pie-players/pie-context@0.3.65

## 0.3.64

### Patch Changes

- Updated dependencies [82118ce]
- Updated dependencies [9b2f37d]
- Updated dependencies [acee584]
- Updated dependencies [9b2f37d]
- Updated dependencies [5749bc1]
- Updated dependencies [82edb28]
- Updated dependencies [a5241b9]
- Updated dependencies [0dcec2e]
- Updated dependencies [acee584]
- Updated dependencies [25511d7]
- Updated dependencies [bbcabc0]
- Updated dependencies [30baec4]
  - @pie-players/pie-assessment-toolkit@0.3.64
  - @pie-players/pie-context@0.3.64

## 0.3.63

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.63
- @pie-players/pie-context@0.3.63

## 0.3.62

### Patch Changes

- Updated dependencies [c73c995]
- Updated dependencies [507b56f]
- Updated dependencies [a1edde5]
- Updated dependencies [7864f66]
- Updated dependencies [3b4e461]
- Updated dependencies [7605500]
  - @pie-players/pie-assessment-toolkit@0.3.62
  - @pie-players/pie-context@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.61
- @pie-players/pie-context@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.60
- @pie-players/pie-context@0.3.60

## 0.3.59

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.59
  - @pie-players/pie-context@0.3.59

## 0.3.58

### Patch Changes

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

- Updated dependencies [bead424]
  - @pie-players/pie-assessment-toolkit@0.3.54
  - @pie-players/pie-context@0.3.54

## 0.3.53

### Patch Changes

- 20fc985: Add component-scoped active/open inline tool trigger theme hooks so hosts can style TTS and calculator trigger states without overriding broad semantic tokens.
  - @pie-players/pie-assessment-toolkit@0.3.53
  - @pie-players/pie-context@0.3.53

## 0.3.52

### Patch Changes

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
