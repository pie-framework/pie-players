# @pie-players/pie-item-list

## 1.0.0-beta.10

### Patch Changes

- 022bb44: Players answer `interfaceLocaleContext` with the locale the host asked for, from the moment it is set, and `<pie-item-list>` and `<pie-item-summary>` forward `locale` so an explicit `en-US` is answered there too; a row or player handed a provider its owner already asked for that locale leaves it alone, so a failed catalog loads and reports once. The toolkit and section shell stamp `lang` and `dir` only once a host chose a locale. In the i18n engine, `getLocale()` names the locale actually served, a host override for `es-MX` layers over a shipped `es` catalog, and a host override of one plural category keeps the catalog's other forms instead of throwing.
- cdedeb8: Every package now ships a `LICENSE` file, the published bundles keep the `@license` notices of the libraries they inline (DOMPurify, lit, MathJax, speech-rule-engine, MathLive, Compute Engine, JSXGraph), and every package that inlines third-party code ships a `THIRD-PARTY-LICENSES.txt` beside its bundles with each inlined package's version and full licence text; builds used to strip the notices. `@pie-players/pie-calculator-cortex`'s licence file is now the MIT text plus the third-party notices.
- 80f5264: The section player's and item list's npm builds no longer inline `@pie-players/pie-assessment-toolkit`, `@pie-players/pie-players-shared` or `@pie-players/pie-context`. They import them from the host's `node_modules`, as every tool already does, so they share one copy of each with the toolkit and the tools. The item player still inlines its own players-shared and pie-context, since its one `dist` is also its CDN file. The section player's npm entry drops from about 1.1 MB to 330 KB and the item list's from 720 KB to 580 KB. `@pie-players/pie-context` moves to the section player's `dependencies`, and `speech-rule-engine` leaves them, since the toolkit owns that import. The `./browser` builds stay self-contained.
- cdedeb8: Every `exports` entry of every published package now lists a `default` condition straight after `import`, with the same target. `require.resolve` and any resolver that matches neither `import` nor `types` used to fail with `ERR_PACKAGE_PATH_NOT_EXPORTED` and now land on the ESM file. The packages stay ESM-only; none ships CommonJS, and `docs/install/packages.md` says so.
- ed88428: Published bundles are fully minified, whitespace included, about a fifth smaller across the suite; licence and `/*!` comments stay, and `/* @__PURE__ */` annotations go. The Cortex calculator ships one copy of Compute Engine, shared by the main bundle and its evaluation worker, which cuts the package from about 14 MB to 8.4 MB, and the worker keeps its blob wrapper for cross-origin pages. Packages publish only the declaration files a type entry reaches. `check:bundle-safety` fails any Vite bundle that is not minified, and `check:declaration-reachability` fails a package that ships an unreachable declaration.
- c100692: The `@pie-players/pie-players-shared` root now lists its exports by name. The object helpers, attribute coercion and content styles are exported only from their subpaths (`/object`, `/ui/attribute-coercion`, `/ui/content-styles`), and the root no longer carries internal UI helpers that no published package or host imports from it: `createPointerRotateController`, `normalizeDegrees`, the safe-storage helpers, `isTabbable`, `scopeSelector`, the overlay geometry functions and placement step constants, and the pointer and overlay helper types. The test-only `resetContentStylesWarningForTesting` is gone from every entry.
  
  Every package exports `./package.json`, so a tool can read the installed version through the `exports` map.
  
  Only the four CDN entry points keep `unpkg` and `jsdelivr`. The section player's and the item list's now name their `dist/browser/` build, which is the file a CDN page loads; every other package drops both fields.
- Updated dependencies [e566569]
- Updated dependencies [022bb44]
- Updated dependencies [e38d28c]
- Updated dependencies [6ab52cc]
- Updated dependencies [3c450db]
- Updated dependencies [e3e6da5]
- Updated dependencies [6d4cba0]
- Updated dependencies [b8ba5f4]
- Updated dependencies [cdedeb8]
- Updated dependencies [cdedeb8]
- Updated dependencies [da266bd]
- Updated dependencies [ed88428]
- Updated dependencies [c100692]
  - @pie-players/pie-item-player@1.0.0-beta.10
  - @pie-players/pie-players-shared@1.0.0-beta.10

## 1.0.0-beta.9

### Patch Changes

- Updated dependencies [5eb7c60]
  - @pie-players/pie-players-shared@1.0.0-beta.9
  - @pie-players/pie-item-player@1.0.0-beta.9

## 1.0.0-beta.8

### Patch Changes

- Updated dependencies [551ffeb]
- Updated dependencies [525c81c]
- Updated dependencies [da39465]
- Updated dependencies [08d1f9a]
- Updated dependencies [e79c775]
- Updated dependencies [ca970e3]
- Updated dependencies [d29b05c]
- Updated dependencies [a9695b7]
- Updated dependencies [dfa89e1]
- Updated dependencies [0e6352f]
  - @pie-players/pie-players-shared@1.0.0-beta.8
  - @pie-players/pie-item-player@1.0.0-beta.8

## 1.0.0-beta.7

### Patch Changes

- Updated dependencies [885b07e]
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
- Updated dependencies [cb55fee]
  - @pie-players/pie-players-shared@1.0.0-beta.7
  - @pie-players/pie-item-player@1.0.0-beta.7

## 1.0.0-beta.6

### Patch Changes

- Updated dependencies [782d395]
  - @pie-players/pie-item-player@1.0.0-beta.6
  - @pie-players/pie-players-shared@1.0.0-beta.6

## 1.0.0-beta.5

### Patch Changes

- 5cd8dec: Elements summarize through bundled summarizers by default. `bundledSummaries` covers 27 `@pie-element` packages, with numbered cloze blanks and language-neutral answer notation; `pinnedSummaries(loaderOptions)` loads each element's own `./browser/summary` at its pinned version, skipping packages the `loaderOptions` element package policy refuses. A resolver that returns `null` restores the prompt and label rungs.
- 2dee856: Adds `<pie-item-list>`: `<pie-item-summary>` rows with a details column, host actions, the item's summary clipped below the first line of each of its `passages`, the entry's search `highlights` below it and a sticky expand button that mounts the item's players. An entry may leave `config` out and carry a `summary`, for a host that fetches the item on `expanded-changed`. A match snippet renders only its text and `<mark>` elements. `details`, `actions` and `highlights` take a custom element tag name, which receives the entry as `entry`, or a render function that may return an `{ update, destroy }` handle or a promise of one; a failing extension fires `extension-error`. `expandedIds` expands rows by id over `expanded`, and the list re-dispatches its rows' `load-complete` and `player-error` with the entry `id` and `part`. One i18n provider serves the list, its rows and their players. `<pie-item-summary>` and the list gain `loaderConfig`, passed to the player. The interface catalogs gain `player.list.expandA11y`, `player.list.collapse`, `player.list.playerError` and `player.list.highlights`, and the theme registers `--pie-item-list-clip-height` and `--pie-item-list-sticky-top`.
- 3e65a8a: Adds `convertSummaryMath` to `./summarize`, which converts the TeX in a summary's HTML to MathML so a backend can store summaries a row renders without loading a math converter.
- 04933c5: `<pie-item-summary>` keeps a correct option's label on its check mark's line when the authored label is wrapped in a block element such as `<div>` or `<p>`.
- f5e11b1: `<pie-item-summary>` keeps its summary and its loaded player when a host sets an equal `config`, `summary`, `env`, `loaderOptions` or `loaderConfig` object again, comparing plain objects and arrays by content and anything else by identity.
- 949c42b: `<pie-item-summary>` takes an `i18n` provider and passes its provider to the expanded `<pie-item-player>`, so the player's chrome follows the row's `locale`. A failed locale load fires `framework-error`. The outer margins of authored stem, prompt, option and answer fragments no longer add to the view's own spacing.
- f02f97f: `<pie-item-summary>` gains `expanded`, `strategy` and `loaderOptions`: an expanded row mounts `<pie-item-player>` near the viewport and swaps it in once loaded, with element loads aggregated and capped page-wide. `@pie-players/pie-item-player` exports `preloadItemElements`, and `@pie-players/pie-item-list/browser` is a self-contained build for CDN use.
- db7d543: `<pie-item-summary>` withholds answers for any `env.role` other than `instructor`, as `summarizeItem` and `<pie-item-player>` do; no `env` stays the instructor view. Summaries with repeated element or option ids render instead of failing, and a summary that fails to render no longer leaves the previous item's summary showing.
- e7b312f: `<pie-item-summary>` now checks a precomputed `summary` field by field and recomputes a malformed one from `config`. The same check is exported from `./summarize` as `isItemSummary`. Options that carry a `group` render nested under the group's label. A new `env` object with an unchanged `role` no longer re-renders the row or fires another `load-complete`.
- c2d0182: `pinnedSummaries` retries a summarizer whose load failed because the CDN was unreachable or answered 408, 429 or 5xx, up to three times per page, instead of keeping the prompt rung for the rest of the page.
- Updated dependencies [e0797ec]
- Updated dependencies [db7d543]
- Updated dependencies [2dee856]
- Updated dependencies [f5e11b1]
- Updated dependencies [f02f97f]
- Updated dependencies [5a33154]
  - @pie-players/pie-players-shared@1.0.0-beta.5
  - @pie-players/pie-item-player@1.0.0-beta.5

## 1.0.0-beta.4

### Patch Changes

- b6887bb: Add `@pie-players/pie-item-list`: `summarizeItem` (from `./summarize`, Node-safe) reduces a PIE item to a readable summary, and `<pie-item-summary>` renders it as one sanitized list row with math as MathML and answers for instructors only, loading no element code. No summarizer resolver ships yet, so elements summarize from their prompt or label. The row's labels add `player.summary.*` keys to the bundled and generated catalogs.
- Updated dependencies [6dd6280]
- Updated dependencies [e2f6bde]
- Updated dependencies [3f275b5]
- Updated dependencies [32eab13]
- Updated dependencies [05e4137]
- Updated dependencies [074dfa6]
- Updated dependencies [bd7be0e]
- Updated dependencies [28edb54]
- Updated dependencies [171c84e]
- Updated dependencies [18e07d9]
- Updated dependencies [2f34312]
- Updated dependencies [6d2dcb4]
- Updated dependencies [a3432aa]
- Updated dependencies [b6887bb]
- Updated dependencies [55033fa]
- Updated dependencies [765ddbf]
- Updated dependencies [b1f5a06]
- Updated dependencies [9d1bab9]
  - @pie-players/pie-players-shared@1.0.0-beta.4
