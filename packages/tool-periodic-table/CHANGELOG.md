# @pie-players/pie-tool-periodic-table

## 0.3.69

### Patch Changes

- Updated dependencies [ced07e0]
- Updated dependencies [004d38e]
- Updated dependencies [cb99eae]
- Updated dependencies [8bb668b]
- Updated dependencies [787ad8f]
- Updated dependencies [3544e9d]
- Updated dependencies [6e2d488]
- Updated dependencies [cb99eae]
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

- 1e0c10f: Collapse fixed component hues into the palette under a colour scheme.

  A component sometimes paints a hue the palette does not own: the periodic
  table's element cells encode category as a fixed pastel. Pinning their ink made
  them legible under a dark theme, but a colour scheme is a two-colour promise,
  and a pastel field ignores it — a learner on yellow-on-blue got a pastel grid.

  `--pie-fixed-hue-collapse` is the share by which such a hue folds into the
  palette. A component mixes its own value towards `--pie-background-dark` and
  `--pie-text` by this share, so `0%` renders the authored hue exactly and `100%`
  removes it. Base Themes set `0%`; every built-in colour scheme sets `100%`, and
  a registered custom scheme collapses without declaring anything, because it is a
  palette a host chose for a learner. A scheme that wants a hue encoding kept sets
  `0%` itself.

  Both ends of the mix are exact, so a Base Theme renders the periodic table byte
  for byte as before. Under a scheme its cells take the scheme's recessed surface
  and ink — measured across all ten built-ins, 5.44:1 at worst and 19.26:1 at best
  — and the cell edge takes `--pie-border`, which the palette corrects to 3:1,
  because collapsed fills sit on the panel at about 1.1:1 and can no longer
  separate themselves. Category then lives where it does not depend on hue: the
  badge row filters by it, the selected-element panel names it, and each cell's
  accessible name carries it.

  Sweeping those ten also cost the cell's secondary text its opacity. Fading the
  atomic number, name and mass spent contrast the palette cannot always afford: at
  0.8 the atomic mass measured 4.12:1 under grey-on-light-grey and 4.00:1 under
  purple-on-light-green, whose ink and recessed surface hold only 6.46:1 and 5.44:1
  before anything is faded. Size and weight carry the hierarchy instead, which also
  lifts the worst pairing under a Base Theme from 6.01:1 to 8.99:1.

  `--pie-text` against `--pie-background-dark` is now a certified contrast
  relationship, since that pair is where a collapsed hue lands. Every built-in
  palette already clears it; a custom scheme that does not now warns.

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

- 08f77f5: Make the periodic table's category filter de-emphasise instead of empty the grid.

  The cell markup has always carried a `--dim` class for elements outside the
  active filter, but the each-block iterated an already-filtered list, so the class
  could never apply: choosing a category removed every other element and left the
  table as its own layout with holes in it. A periodic table read for one category
  is still read against the whole table, so the filter now renders every element
  and marks the ones outside it.

  The dim treatment is not the `grayscale(80%)`/`opacity: 0.4` the dead rule
  declared. Fading a cell far enough to read as dimmed composites its text towards
  the page and takes it under 4.5:1 — 0.4 leaves it near 1.8:1 — and these cells
  stay focusable and clickable, so SC 1.4.3 applies. A filtered-out cell drops its
  category fill to the panel surface and takes theme ink instead, which measures
  17.7:1 under the light Base Theme and, across the ten built-in schemes, 6.21:1 at
  worst, and it turns its border dashed. The border _style_ rather than its colour: under a colour
  scheme every cell already shares one surface, so the fill can no longer carry the
  state, and a stronger edge would read as emphasis when the matching cells' edge is
  deliberately faint.

  Dimming is visual, so a filtered-out cell also says so in its accessible name.

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
  - @pie-players/pie-players-shared@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.56
  - @pie-players/pie-context@0.3.56
  - @pie-players/pie-players-shared@0.3.56

## 0.3.55

### Patch Changes

- Updated dependencies [7f45877]
  - @pie-players/pie-players-shared@0.3.55
  - @pie-players/pie-assessment-toolkit@0.3.55
  - @pie-players/pie-context@0.3.55

## 0.3.54

### Patch Changes

- Updated dependencies [bead424]
  - @pie-players/pie-assessment-toolkit@0.3.54
  - @pie-players/pie-context@0.3.54
  - @pie-players/pie-players-shared@0.3.54

## 0.3.53

### Patch Changes

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

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.51
  - @pie-players/pie-context@0.3.51
  - @pie-players/pie-players-shared@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.50
  - @pie-players/pie-context@0.3.50
  - @pie-players/pie-players-shared@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.49
  - @pie-players/pie-context@0.3.49
  - @pie-players/pie-players-shared@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0c20d0f]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.48
  - @pie-players/pie-assessment-toolkit@0.3.48
  - @pie-players/pie-context@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.47
  - @pie-players/pie-context@0.3.47
  - @pie-players/pie-players-shared@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.46
  - @pie-players/pie-context@0.3.46
  - @pie-players/pie-players-shared@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies [fd140a3]
  - @pie-players/pie-assessment-toolkit@0.3.45
  - @pie-players/pie-context@0.3.45
  - @pie-players/pie-players-shared@0.3.45

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.44
  - @pie-players/pie-context@0.3.44
  - @pie-players/pie-players-shared@0.3.44

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [6496dda]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.42
  - @pie-players/pie-context@0.3.42
  - @pie-players/pie-players-shared@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.41
  - @pie-players/pie-context@0.3.41
  - @pie-players/pie-players-shared@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [3a167a8]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.40
  - @pie-players/pie-assessment-toolkit@0.3.40
  - @pie-players/pie-context@0.3.40

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0072fad]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.39
  - @pie-players/pie-players-shared@0.3.39
  - @pie-players/pie-context@0.3.39

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

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [2818f93]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.37
  - @pie-players/pie-context@0.3.37
  - @pie-players/pie-players-shared@0.3.37

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [9ef211c]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.36
  - @pie-players/pie-context@0.3.36
  - @pie-players/pie-players-shared@0.3.36

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [286418e]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.35
  - @pie-players/pie-context@0.3.35
  - @pie-players/pie-players-shared@0.3.35

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [af850c0]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.34
  - @pie-players/pie-context@0.3.34
  - @pie-players/pie-players-shared@0.3.34

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [70612af]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.33
  - @pie-players/pie-context@0.3.33
  - @pie-players/pie-players-shared@0.3.33

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0355143]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.32
  - @pie-players/pie-context@0.3.32
  - @pie-players/pie-players-shared@0.3.32

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [26dbea3]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.31
  - @pie-players/pie-players-shared@0.3.31
  - @pie-players/pie-context@0.3.31

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0981bc3]
- Updated dependencies [698aa82]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.30
  - @pie-players/pie-assessment-toolkit@0.3.30
  - @pie-players/pie-context@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.29
  - @pie-players/pie-context@0.3.29
  - @pie-players/pie-players-shared@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.28
  - @pie-players/pie-context@0.3.28
  - @pie-players/pie-players-shared@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.27
  - @pie-players/pie-context@0.3.27
  - @pie-players/pie-players-shared@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.26
  - @pie-players/pie-context@0.3.26
  - @pie-players/pie-players-shared@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.25
  - @pie-players/pie-context@0.3.25
  - @pie-players/pie-players-shared@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.25
  - @pie-players/pie-context@0.3.25
  - @pie-players/pie-players-shared@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.24
  - @pie-players/pie-context@0.3.24
  - @pie-players/pie-players-shared@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.23
  - @pie-players/pie-context@0.3.23
  - @pie-players/pie-players-shared@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.22
  - @pie-players/pie-context@0.3.22
  - @pie-players/pie-players-shared@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.21
  - @pie-players/pie-context@0.3.21
  - @pie-players/pie-players-shared@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.20
  - @pie-players/pie-context@0.3.20
  - @pie-players/pie-players-shared@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.19
  - @pie-players/pie-context@0.3.19
  - @pie-players/pie-players-shared@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.18
  - @pie-players/pie-context@0.3.18
  - @pie-players/pie-players-shared@0.3.18

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.17
  - @pie-players/pie-context@0.3.17
  - @pie-players/pie-players-shared@0.3.17

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.16
  - @pie-players/pie-context@0.3.16
  - @pie-players/pie-players-shared@0.3.16

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.15
  - @pie-players/pie-context@0.3.15
  - @pie-players/pie-players-shared@0.3.15

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.14
  - @pie-players/pie-context@0.3.14
  - @pie-players/pie-players-shared@0.3.14

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.13
  - @pie-players/pie-context@0.3.13
  - @pie-players/pie-players-shared@0.3.13

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.12
  - @pie-players/pie-context@0.3.12
  - @pie-players/pie-players-shared@0.3.12

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.11
  - @pie-players/pie-context@0.3.11
  - @pie-players/pie-players-shared@0.3.11

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.10
  - @pie-players/pie-context@0.3.10
  - @pie-players/pie-players-shared@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.9
  - @pie-players/pie-context@0.3.9
  - @pie-players/pie-players-shared@0.3.9

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.10
  - @pie-players/pie-context@0.3.10
  - @pie-players/pie-players-shared@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.9
  - @pie-players/pie-context@0.3.9
  - @pie-players/pie-players-shared@0.3.9

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.8
  - @pie-players/pie-context@0.3.8
  - @pie-players/pie-players-shared@0.3.8

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.7
  - @pie-players/pie-context@0.3.7
  - @pie-players/pie-players-shared@0.3.7

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.6
  - @pie-players/pie-context@0.3.6
  - @pie-players/pie-players-shared@0.3.6

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.5
  - @pie-players/pie-context@0.3.5
  - @pie-players/pie-players-shared@0.3.5

## 0.3.4

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.4
  - @pie-players/pie-context@0.3.4
  - @pie-players/pie-players-shared@0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.3
  - @pie-players/pie-context@0.3.3
  - @pie-players/pie-players-shared@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.2
  - @pie-players/pie-context@0.3.2
  - @pie-players/pie-players-shared@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.3.1
  - @pie-players/pie-context@0.3.1
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
  - @pie-players/pie-context@0.3.0
  - @pie-players/pie-players-shared@0.3.0

## 0.1.10

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/pie-assessment-toolkit@0.2.10
  - @pie-players/pie-context@0.1.2
  - @pie-players/pie-players-shared@0.2.6

## 0.1.9

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
- Updated dependencies [71a9581]
  - @pie-players/pie-assessment-toolkit@0.2.9
  - @pie-players/pie-context@0.1.1
  - @pie-players/pie-players-shared@0.2.5
