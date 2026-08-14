# @pie-players/pie-print-player

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

- 001486e: Preserve authored attributes and children through the print tag swap, and sanitize print markup by default.

  `processMarkup` previously carried only `id`, `pie-id`, and `data-original-tag` onto the freshly built print element, so everything else authored on that element was silently dropped:

  - `class`, `style`, `lang`, `dir`, `aria-*`, and `data-*` were lost. An item authored as `<multiple-choice id="1" class="noprint">` lost its print-suppression hook and printed anyway on hosts that load `@pie-players/pie-theme/components.css`.
  - Child nodes were lost, discarding authored fallback content and destroying nested interactive elements — a nested element could even be reported in the returned node list while being absent from the returned markup.

  All attributes are now copied and children are moved across. `id`, `pie-id`, and `data-original-tag` are still set by the processor so they win over any authored value of the same name.

  `<pie-print>` now also sanitizes authored `item.markup` through `@pie-players/pie-players-shared/security` by default, matching `<pie-item-player>`. Hosts can opt out with the `trust-markup` attribute or supply their own sanitizer via the `sanitizeMarkup` property. The interactive element tags from `item.elements` and their hashed print variants are allow-listed so sanitizing does not strip them.

  `sanitizeItemMarkup` gains a `wrapOverwideContent` option (default `true`, unchanged for the screen players). The print player passes `false`: the overwide image/table wrappers are `overflow-x: auto` reflow affordances with no `@media print` override, and `overflow` clips rather than scrolls in print media, so wide images and tables would be cut off.

  Also drops the `static styles` block from `PiePrint`. It declared a `:host` border, padding and `max-width`, none of which ever applied: `createRenderRoot()` returns `this` for light-DOM rendering, so Lit never calls `adoptStyles`. Removing dead declarations, no rendered change.

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

- f3da607: Normalize `repository.url` to the `git+https://` form. npm compares this against the repository it publishes from when generating a provenance attestation, and rewrites any other form with a warning, so the canonical form is now required by `check:package-metadata`.
  - @pie-players/pie-players-shared@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-players-shared@0.3.60

## 0.3.59

### Patch Changes

- @pie-players/pie-players-shared@0.3.59

## 0.3.58

### Patch Changes

- Updated dependencies [8df52bf]
- Updated dependencies [d5cc905]
  - @pie-players/pie-players-shared@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.56

## 0.3.55

### Patch Changes

- Updated dependencies [7f45877]
  - @pie-players/pie-players-shared@0.3.55

## 0.3.54

### Patch Changes

- @pie-players/pie-players-shared@0.3.54

## 0.3.53

### Patch Changes

- @pie-players/pie-players-shared@0.3.53

## 0.3.52

### Patch Changes

- Updated dependencies [017f5a9]
  - @pie-players/pie-players-shared@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0c20d0f]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

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

- 0072fad: Move Svelte out of published runtime dependencies and add a release check that rejects future accidental `svelte` runtime dependency declarations. Assessment toolkit custom-element outputs now bundle their Svelte runtime helpers so consumers do not install a second Svelte runtime through player packages.
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
