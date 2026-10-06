# @pie-players/pie-tool-calculator-inline-cortex

## 0.3.74

### Patch Changes

- 799b592: The inline calculator buttons stay visible and open the calculator. Placed
  inside `<pie-item-shell>`, a button toggles the item toolbar's calculator,
  `calculator:item:<itemId>`; it used to register itself with the tool
  coordinator, which hid it, and toggle its own id. `target-tool-id` still names
  another calculator id and now defaults to empty on every variant, and the unused
  `tool-id` attribute is gone. With no item shell and no `target-tool-id` the
  button is disabled and logs a console warning.
- 25fd8d8: Loading a second copy of a player or tool into a page that already registered
  its custom elements no longer throws. The copy that registered a tag first keeps
  rendering it, the rule `pie-item-player` and the toolkit's elements already
  follow.
- 5a0bcb1: The `pie-tool-*` bundles import the toolkit and `pie-players-shared` from the
  host's `node_modules` instead of inlining them, and the section player imports
  `@pie-players/pie-item-player`, so a page with both players defines one
  `pie-item-player` and fetches one MathJax module. The toolkit's `sideEffects`
  lists only its custom elements.
  
  The section player's `./contracts/*` and `./policies` subpaths register no
  element and import in Node. Each exports only its own module's names, so import
  anything else from the package root. `pie-players-shared` drops
  `./server/npm-registry` and `./server/npm-auth-env`.
  `pie-tool-calculator-shared`'s root entry no longer exports the calculator
  shells: it registers `<pie-tool-calculator>`, as `./calculator-element` does,
  and the package no longer depends on `svelte`. `speech-rule-engine` is pinned to
  `5.0.0-rc.4`, whose locale tables the toolkit imports by file path, and math
  rendering imports `@pie-lib/math-rendering-module/module/index.js`, which
  webpack's fully-specified ESM resolution finds.
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
- Updated dependencies [7361295]
- Updated dependencies [040299f]
- Updated dependencies [30a037f]
- Updated dependencies [8b24361]
- Updated dependencies [498f937]
- Updated dependencies [2825bf5]
- Updated dependencies [8b24361]
- Updated dependencies [377146f]
- Updated dependencies [3e88cac]
- Updated dependencies [17afe85]
- Updated dependencies [5fb7902]
- Updated dependencies [3cb91c5]
- Updated dependencies [3ccab31]
- Updated dependencies [b072a44]
- Updated dependencies [0e8e8df]
- Updated dependencies [223f00a]
- Updated dependencies [a3e721c]
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
- Updated dependencies [435bb29]
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
- Updated dependencies [2084d88]
- Updated dependencies [cd183fa]
- Updated dependencies [a38056b]
- Updated dependencies [140d39b]
- Updated dependencies [da9e2f7]
- Updated dependencies [fbb61b6]
- Updated dependencies [da37ba4]
- Updated dependencies [771def2]
- Updated dependencies [8a8b932]
- Updated dependencies [7bc44f3]
- Updated dependencies [ec632eb]
- Updated dependencies [7c4b13d]
- Updated dependencies [3ddbe89]
- Updated dependencies [a8c0d7f]
- Updated dependencies [8f4b1da]
- Updated dependencies [8b24361]
- Updated dependencies [ff7c2bc]
- Updated dependencies [5a0bcb1]
- Updated dependencies [0bd34af]
- Updated dependencies [8e13d3d]
- Updated dependencies [799b592]
- Updated dependencies [976c4d3]
- Updated dependencies [45bec78]
- Updated dependencies [6e6f883]
- Updated dependencies [6cc239a]
- Updated dependencies [05845a3]
- Updated dependencies [2cd3d03]
- Updated dependencies [3be570a]
- Updated dependencies [b7c9382]
- Updated dependencies [a0e15b9]
- Updated dependencies [60077c2]
- Updated dependencies [22bcd83]
- Updated dependencies [326f382]
- Updated dependencies [4369286]
- Updated dependencies [3d8bb9a]
- Updated dependencies [e25ebc5]
- Updated dependencies [3a01d9b]
  - @pie-players/pie-assessment-toolkit@0.3.74
  - @pie-players/pie-players-shared@0.3.74

## 0.3.73

### Patch Changes

- Updated dependencies [e2fd6b8]
- Updated dependencies [83d30e3]
  - @pie-players/pie-players-shared@0.3.73
  - @pie-players/pie-assessment-toolkit@0.3.73
  - @pie-players/pie-tool-calculator-shared@0.3.73

## 0.3.72

### Patch Changes

- @pie-players/pie-assessment-toolkit@0.3.72
  - @pie-players/pie-players-shared@0.3.72
  - @pie-players/pie-tool-calculator-shared@0.3.72

## 0.3.71

### Patch Changes

- Updated dependencies [181b124]
- Updated dependencies [69f354e]
- Updated dependencies [6c089fd]
- Updated dependencies [ee795c8]
  - @pie-players/pie-assessment-toolkit@0.3.71
  - @pie-players/pie-players-shared@0.3.71
  - @pie-players/pie-tool-calculator-shared@0.3.71

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
  - @pie-players/pie-tool-calculator-shared@0.3.70

## 0.3.69

### Patch Changes

- 787ad8f: Add a fully bundled open-source calculator provider using MathLive, Cortex
  Compute Engine, and JSXGraph, with basic, scientific, and graphing modes,
  worker-isolated evaluation, accessible graph exploration, direct custom-element
  wrappers, package-owned isolated mode demos, typed English/Dutch localization
  with host message overrides and RTL support, canonical theme-token consumption,
  themeable graph series, and opt-in default-tool-loader composition.
  
  Move registration of the generic `pie-tool-calculator` element into the shared,
  provider-neutral package while retaining the Desmos compatibility entry and
  Desmos as the default provider.
- Updated dependencies [ced07e0]
- Updated dependencies [3017425]
- Updated dependencies [004d38e]
- Updated dependencies [cb99eae]
- Updated dependencies [f24e425]
- Updated dependencies [8bb668b]
- Updated dependencies [787ad8f]
- Updated dependencies [3544e9d]
- Updated dependencies [6e2d488]
- Updated dependencies [cb99eae]
  - @pie-players/pie-assessment-toolkit@0.3.69
  - @pie-players/pie-tool-calculator-shared@0.3.69
  - @pie-players/pie-players-shared@0.3.69
