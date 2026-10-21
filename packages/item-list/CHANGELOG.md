# @pie-players/pie-item-list

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
