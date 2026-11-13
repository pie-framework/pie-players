# @pie-players/pie-tool-magnifier

## 1.0.0-beta.10

### Patch Changes

- cdedeb8: Every package now ships a `LICENSE` file, the published bundles keep the `@license` notices of the libraries they inline (DOMPurify, lit, MathJax, speech-rule-engine, MathLive, Compute Engine, JSXGraph), and every package that inlines third-party code ships a `THIRD-PARTY-LICENSES.txt` beside its bundles with each inlined package's version and full licence text; builds used to strip the notices. `@pie-players/pie-calculator-cortex`'s licence file is now the MIT text plus the third-party notices.
- cdedeb8: Every `exports` entry of every published package now lists a `default` condition straight after `import`, with the same target. `require.resolve` and any resolver that matches neither `import` nor `types` used to fail with `ERR_PACKAGE_PATH_NOT_EXPORTED` and now land on the ESM file. The packages stay ESM-only; none ships CommonJS, and `docs/install/packages.md` says so.
- af92439: Every custom element these packages register now has a typed interface and an `HTMLElementTagNameMap` entry, so `document.querySelector("pie-item-scope")` and the like return the element's properties and methods instead of `HTMLElement`. The section player's kernel host, base, shell, passage shell, item and passage cards and the two panes, the toolkit's four elements, the four tools and the assessment player's shell are covered. `check:custom-elements:dist` now fails when a registered tag has no map entry reachable from a package's type entries.
- ed88428: Published bundles are fully minified, whitespace included, about a fifth smaller across the suite; licence and `/*!` comments stay, and `/* @__PURE__ */` annotations go. The Cortex calculator ships one copy of Compute Engine, shared by the main bundle and its evaluation worker, which cuts the package from about 14 MB to 8.4 MB, and the worker keeps its blob wrapper for cross-origin pages. Packages publish only the declaration files a type entry reaches. `check:bundle-safety` fails any Vite bundle that is not minified, and `check:declaration-reachability` fails a package that ships an unreachable declaration.
- c100692: The `@pie-players/pie-players-shared` root now lists its exports by name. The object helpers, attribute coercion and content styles are exported only from their subpaths (`/object`, `/ui/attribute-coercion`, `/ui/content-styles`), and the root no longer carries internal UI helpers that no published package or host imports from it: `createPointerRotateController`, `normalizeDegrees`, the safe-storage helpers, `isTabbable`, `scopeSelector`, the overlay geometry functions and placement step constants, and the pointer and overlay helper types. The test-only `resetContentStylesWarningForTesting` is gone from every entry.
  
  Every package exports `./package.json`, so a tool can read the installed version through the `exports` map.
  
  Only the four CDN entry points keep `unpkg` and `jsdelivr`. The section player's and the item list's now name their `dist/browser/` build, which is the file a CDN page loads; every other package drops both fields.
- Updated dependencies [e566569]
- Updated dependencies [022bb44]
- Updated dependencies [3c450db]
- Updated dependencies [e3e6da5]
- Updated dependencies [6d4cba0]
- Updated dependencies [b8ba5f4]
- Updated dependencies [388d44c]
- Updated dependencies [cdedeb8]
- Updated dependencies [cdedeb8]
- Updated dependencies [af92439]
- Updated dependencies [da266bd]
- Updated dependencies [ed88428]
- Updated dependencies [c100692]
  - @pie-players/pie-assessment-toolkit@1.0.0-beta.10
  - @pie-players/pie-players-shared@1.0.0-beta.10

## 1.0.0-beta.9

### Patch Changes

- Updated dependencies [5eb7c60]
- Updated dependencies [5eb7c60]
  - @pie-players/pie-assessment-toolkit@1.0.0-beta.9
  - @pie-players/pie-players-shared@1.0.0-beta.9

## 1.0.0-beta.8

### Patch Changes

- Updated dependencies [bfd0d5f]
- Updated dependencies [551ffeb]
- Updated dependencies [ff8ab38]
- Updated dependencies [525c81c]
- Updated dependencies [da39465]
- Updated dependencies [e79c775]
- Updated dependencies [ca970e3]
- Updated dependencies [d29b05c]
- Updated dependencies [4c6773a]
- Updated dependencies [a9695b7]
- Updated dependencies [18ef9e6]
- Updated dependencies [dfa89e1]
- Updated dependencies [f486194]
- Updated dependencies [0e6352f]
  - @pie-players/pie-assessment-toolkit@1.0.0-beta.8
  - @pie-players/pie-players-shared@1.0.0-beta.8

## 1.0.0-beta.7

### Patch Changes

- 067cf18: Keys that commit or cancel an IME composition no longer act on player chrome: the annotation toolbar's keyboard shortcuts, Escape in a focus trap, and the magnifier's Escape ignore them, including Safari's committing Enter, which reports `keyCode` 229 with `isComposing` false. `@pie-players/pie-players-shared` exports the check as `isComposingKeyEvent`.
- Updated dependencies [885b07e]
- Updated dependencies [584a754]
- Updated dependencies [fedd6a0]
- Updated dependencies [c931537]
- Updated dependencies [8259692]
- Updated dependencies [75f1716]
- Updated dependencies [067cf18]
- Updated dependencies [6da86de]
- Updated dependencies [5c6cbe8]
- Updated dependencies [8bd5891]
- Updated dependencies [584a754]
- Updated dependencies [584a754]
- Updated dependencies [b607537]
- Updated dependencies [cb55fee]
- Updated dependencies [584a754]
  - @pie-players/pie-players-shared@1.0.0-beta.7
  - @pie-players/pie-assessment-toolkit@1.0.0-beta.7

## 1.0.0-beta.6

### Patch Changes

- @pie-players/pie-assessment-toolkit@1.0.0-beta.6
  - @pie-players/pie-players-shared@1.0.0-beta.6

## 1.0.0-beta.5

### Patch Changes

- Updated dependencies [e0797ec]
- Updated dependencies [db7d543]
- Updated dependencies [2dee856]
- Updated dependencies [f5e11b1]
  - @pie-players/pie-players-shared@1.0.0-beta.5
  - @pie-players/pie-assessment-toolkit@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- 765ddbf: Add the magnifier (`magnification`, `<pie-tool-magnifier>`): a movable, resizable lens over a live copy of the page. The packaged tool set registers it at section level, and `createPersonalNeedsProfileFromAfa` maps AfA `magnification`'s `zoom-amount` (`all-content`, else the `selectMagnification` `text` amount) to its starting `zoom` tool parameter.
- Updated dependencies [6dd6280]
- Updated dependencies [e2f6bde]
- Updated dependencies [3f275b5]
- Updated dependencies [32eab13]
- Updated dependencies [05e4137]
- Updated dependencies [074dfa6]
- Updated dependencies [bd7be0e]
- Updated dependencies [28edb54]
- Updated dependencies [171c84e]
- Updated dependencies [85e66f7]
- Updated dependencies [18e07d9]
- Updated dependencies [2f34312]
- Updated dependencies [6d2dcb4]
- Updated dependencies [a3432aa]
- Updated dependencies [129a41f]
- Updated dependencies [b6887bb]
- Updated dependencies [55033fa]
- Updated dependencies [765ddbf]
- Updated dependencies [67112f8]
- Updated dependencies [b1f5a06]
- Updated dependencies [9d1bab9]
  - @pie-players/pie-players-shared@1.0.0-beta.4
  - @pie-players/pie-assessment-toolkit@1.0.0-beta.4
