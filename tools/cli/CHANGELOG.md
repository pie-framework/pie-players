# @pie-players/pie-players-cli

## 0.3.8

### Patch Changes

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

## 0.3.7

### Patch Changes

- 69f0b76: Load a generated `@pie-players/pie-preloaded-player` build into a page that
  already registered `pie-item-player`, which is what a host running the section
  player presents (PIE-1070).
  
  The build's own copy of the item player redefined the tag, threw
  `NotSupportedError` and rejected the build's initialization. The item player
  now registers only through `definePieItemPlayer`, which leaves a registered tag
  alone, and the generated entry skips fetching its copy when the tag is taken.
  Whichever copy registered `pie-item-player` first renders the build's elements.
  `definePieItemPlayer(tagName)` also registers a working element under a custom
  tag.
- 542032b: A generated `@pie-players/pie-preloaded-player` build serves the fonts and speech
  worker of a MathJax bundled into an element from `dist/mathjax/npm/`, and ships
  the page's MathJax only for elements that render on it.
- 8c3d142: A generated `@pie-players/pie-preloaded-player` build bundles its elements with
  Vite from their pie-elements-ng ESM browser builds, and ships the MathJax they
  render with, so no element, MathJax, font or speech file comes from the PITS
  bundle service or a CDN. The generator refuses an element without an ESM browser
  build. The `knowledge-checks` and `star-0326` sets bundled legacy IIFE elements
  and no longer publish; their published builds stay installable.
- 538c2bb: A generated `@pie-players/pie-preloaded-player` build ships MathJax's mhchem font
  extension, which MathJax loads from the build's font path when content uses `\ce`
  or `\pu`.
- ffc7b3e: A generated `@pie-players/pie-preloaded-player` build ships the item player's
  modules with their whitespace stripped. A host that bundles the build loses the
  modules' pure annotations and the `webpackIgnore` hints on the `esm` strategy's
  runtime imports, which the `preloaded` strategy never runs.
- 0e1338b: Stop advertising `window.PIE_LOADER_CONFIG` in generated
  `@pie-players/pie-preloaded-player` builds. The README offered it as a global
  alternative to `loader-config` and the types declared it on `Window`, but no code
  reads it, so configuration set there was ignored. Configure loading on the
  element through `loader-config` or `loaderConfig`.
- 2be7868: Add `registerPreloadedElements` (PIE-1070): a host that bundles the
  `./browser/delivery` modules of pie-elements-ng ESM builds registers them for
  the `preloaded` strategy without a generated `@pie-players/pie-preloaded-player`
  build, passing each package's `./browser/controller` module for a player that
  is not hosted. Only pie-elements-ng ESM builds publish those subpaths. It is
  exported from `@pie-players/pie-players-shared/loaders` and from the new
  `@pie-players/pie-item-player/preloaded`, which also exports
  `ensureItemPlayerMathRenderingReady` without defining the player. Registration
  takes exact versions only and one version per package, and a player that is not
  hosted warns about each preloaded tag registered without a controller.
  `ElementAssertionError` names the tags each missing tag's package is registered
  as.
  
  Generated preloaded builds register through that entry and install the item
  player's own math renderer, keeping one the page already has, so a build's
  `dist/` tree carries `preloaded.js` in place of `math-rendering.js`. The
  session debugger takes `hosted`, `runtimeSupportCheck` probes only under
  `strategy="esm"` through the configured CDN provider, and the ESM import map
  skips specifiers the page already maps.
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

## 0.3.6

### Patch Changes

- Updated dependencies [e2fd6b8]
- Updated dependencies [83d30e3]
  - @pie-players/pie-players-shared@0.3.73

## 0.3.5

### Patch Changes

- @pie-players/pie-players-shared@0.3.72

## 0.3.4

### Patch Changes

- Updated dependencies [69f354e]
- Updated dependencies [6c089fd]
- Updated dependencies [ee795c8]
  - @pie-players/pie-players-shared@0.3.71

## 0.3.3

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

## 0.3.2

### Patch Changes

- @pie-players/pie-players-shared@0.3.69

## 0.3.1

### Patch Changes

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

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

## 0.1.3

### Patch Changes

- beffcc0: Release all publishable packages.

## 0.1.2

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
