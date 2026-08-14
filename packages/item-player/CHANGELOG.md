# @pie-players/pie-item-player

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
