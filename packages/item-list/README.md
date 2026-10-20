# @pie-players/pie-item-list

Readable summaries of PIE items for item banks, search results and section
outlines. `summarizeItem` reduces an item to data, `<pie-item-summary>`
renders it as one list row, with no element code loaded until the row expands
into an item player, and `<pie-item-list>` composes rows with details, actions,
search matches and an expand button. PIE stands for
Portable Interactions and Elements. The design is the
[Item summaries and item lists PRD](../../docs/prds/item-summary-and-list.md).

## Overview

- Each element in the item takes the first rung that yields content:
  1. **Summary**: the element's summarizer, from the resolver, when it returns
     a non-empty summary. A summarizer that throws counts as
     absent and logs one console warning per package.
  2. **Prompt**: `model.prompt` unless `promptEnabled` is `false`, or else the
     prompts of the model's direct object-valued children, such as EBSR's
     `partA` and `partB`.
  3. **Label**: the display name derived from the package, dropped when any
     other entry in the item has content.
- Element tags in the item markup set the order, and the markup outside them
  becomes the stem. A model with no tag in the markup is skipped; an item
  without markup follows model order.
- `teacherInstructions` and `rationale` never appear. Answers and correct
  options appear for instructors only.
- Cloze blanks show as numbered markers, `[1]`, matching a numbered answer
  list, and a blank's options are grouped under the same number. Answers use
  language-neutral notation: interval notation for number lines, equations and
  coordinates for graphs, a fraction for fraction models.

## Installation

```bash
bun add @pie-players/pie-item-list
```

## Summaries as data

`@pie-players/pie-item-list/summarize` registers no custom element and touches
no DOM, so a server can precompute summaries:

```ts
import { summarizeItem } from "@pie-players/pie-item-list/summarize";

const summary = await summarizeItem(item, { role: "instructor" });
```

A `role` other than `"instructor"` strips answers. `resolve(tagName, spec)`
picks each element's summarizer: it receives the tag and the versioned package
spec from the item's `elements` map, and returns a `SummarizeFn` from
`@pie-element/shared-types`, or `null` for the prompt rung. Two resolvers ship:

- **`bundledSummaries`** (default) looks the package up in the bundled set,
  ignoring the version, and loads the set once per page. It covers 27
  `@pie-element` packages.
- **`pinnedSummaries(loaderOptions)`** imports the element's own
  `./browser/summary` module at the version the item pins, from the CDN that
  `esmCdnUrl` and `esmCdnProvider` name, so a host passes the item player's
  `loaderOptions`. Each URL loads once per page, and a version without the
  module takes the prompt rung, as does a package that `elementPackagePolicy`
  refuses, which never loads. A load that fails because the CDN is
  unreachable or answers 408, 429 or 5xx gives that row the prompt rung, and
  the next row to resolve the URL retries, up to three times per page.

A resolver that always returns `null` turns summarizers off:

```ts
await summarizeItem(item, { role: "student", resolve: async () => null });
```

`isItemSummary(value)` checks a stored summary against schema 1 field by field,
ignoring unknown fields. `<pie-item-summary>` runs the same check on its
`summary` property.

### Server precompute

A backend can compute a summary on item write, store it with the item and pass
it to the row through `summary`. `convertSummaryMath` converts the TeX in every
HTML field to MathML first, so the row loads no math converter:

```ts
import { convertSummaryMath, summarizeItem } from "@pie-players/pie-item-list/summarize";

const summary = await convertSummaryMath(await summarizeItem(item, { role: "instructor" }));
```

Store the instructor summary: the row strips answers again for students. TeX
the converter cannot read stays as authored, and the row converts it as it
would an unconverted summary.

## `<pie-item-summary>`

Importing the package registers `<pie-item-summary>` and
[`<pie-item-list>`](#pie-item-list). The row renders into its
light DOM, so host content styles reach it.

```html
<pie-item-summary></pie-item-summary>
<script type="module">
  import "@pie-players/pie-item-list";

  const row = document.querySelector("pie-item-summary");
  row.config = item;
  row.env = { mode: "view", role: "student" };
</script>
```

| Property | Type | Notes |
| --- | --- | --- |
| `config` | `ItemConfig` | The item to summarize |
| `env` | `Env` | Default `{ mode: "view", role: "instructor" }`. An `env` whose `role` is not `"instructor"`, a missing `role` included, withholds answers |
| `summary` | `ItemSummary` | Optional precomputed summary. Used instead of `config` when `isItemSummary` accepts it, and recomputed from `config` otherwise; answers are stripped again for students |
| `resolve` | `SummaryResolver` | Summarizer lookup, as for `summarizeItem`. Default `bundledSummaries` |
| `locale` | `string` | BCP-47 tag for the row's labels and its player's, set on the row's provider or on `i18n`. Default `en-US` |
| `i18n` | `I18nProvider` | A provider for the row's labels and its player's, in place of one the row creates. With no `locale`, it keeps its own locale |
| `expanded` | `boolean` | Shows the item in `<pie-item-player>` ([player view](#player-view)). Also an attribute |
| `strategy` | `"iife" \| "esm" \| "preloaded"` | The player's [loading strategy](../../docs/item-player/loading-strategies.md). Default `iife`. Also an attribute |
| `loaderOptions` | `PieItemPlayerLoaderOptions` | The player's `loaderOptions` |
| `loaderConfig` | `LoaderConfig` | The player's `loaderConfig`, such as `{ trackPageActions: false }` |

| Event | Detail | Notes |
| --- | --- | --- |
| `load-complete` | `{ view: "summary" \| "player" }` | `summary` once per rendered summary, after math conversion; a new `env` object with the same `role` does not re-render. `player` once the expanded row's player has loaded |
| `player-error` | `{ code, message, recoverable }` | The expanded row's player failed. The summary keeps showing |
| `framework-error` | `{ kind: "i18n-locale-load", … }` | The `locale` catalog failed to load. The labels stay English; setting `locale` again retries |

Every HTML fragment renders through the players' markup sanitizer. Options
render as a list, with a check mark and a text alternative on correct options
for instructors. Options that carry a `group` (a blank, row or category) render
as nested lists under their group's label, in order of each group's first
option. Manual scoring shows as a badge, and `figure` as an image. TeX
converts to MathML through `texToMathml` from
`@pie-element/shared-math-rendering-mathjax`, which loads only when a summary
holds TeX.

### Player view

An expanded row mounts `<pie-item-player>` for its item, with the row's
`config`, `env`, `strategy`, `loaderOptions`, `loaderConfig` and i18n provider, and `addCorrectResponse` for
instructors. The summary keeps showing until the player fires `load-complete`,
then the player replaces it; collapsing unmounts the player and shows the
summary again. The item player loads with the first expanded row, so a list
that never expands loads no player code. Setting `config`, `summary`, `env`,
`loaderOptions` or `loaderConfig` to an object with the same content keeps the
summary and the loaded player: plain objects and arrays compare by content,
functions and other objects by identity.

All rows on a page share one scheduler:

- A row's player mounts once the row is within 200px of the viewport, or
  straight away where the browser has no `IntersectionObserver`.
- Rows that come into view together register their elements in one load:
  `preloadItemElements` from `@pie-players/pie-item-player`, one per
  `strategy`, `loaderOptions` object and `loaderConfig` object. A list passes
  every row the same objects; a host setting them on rows itself keeps one
  reference per configuration, or each row loads its elements alone.
- At most three players load at once. The rest wait in the order they came
  into view, and a row scrolled away before its turn waits until it returns.

The player's own `load-complete` and `player-error` stop at the row, which
dispatches its own. A non-recoverable player error unmounts the player.
Besides the player's codes, `player-error` carries:

| Code | Recoverable | Cause |
| --- | --- | --- |
| `ITEM_SUMMARY_PLAYER_UNAVAILABLE` | yes | `@pie-players/pie-item-player` failed to import |
| `ITEM_SUMMARY_PLAYER_TIMEOUT` | yes | The player did not load within 30 seconds; it unmounts |

Collapsing and expanding the row again retries.

## `<pie-item-list>`

A list of `<pie-item-summary>` rows for a host with no list chrome of its own.
Each row shows the entry's details in a leading column, the host's actions in
its top-end corner, the item's summary, with the entry's passages summarized
above it, and the entry's search matches below it. Collapsed, each passage shows
its first line and the item's summary is clipped to
`--pie-item-list-clip-height`, fading out when it runs past the clip. The row's
expand button removes both clips and expands both summaries into players.

```html
<pie-item-list></pie-item-list>
<script type="module">
  import "@pie-players/pie-item-list";

  const list = document.querySelector("pie-item-list");
  list.items = results.map((hit) => ({
    id: hit.id,
    config: hit.config,
    name: hit.name,
    highlights: Object.entries(hit.highlight ?? {}).map(([label, snippets]) => ({ label, snippets })),
    data: hit,
  }));
  list.actions = "bank-row-actions";
  list.details = (entry, host) => {
    host.textContent = `${entry.name} · ${entry.data.owner}`;
  };
</script>
```

| Property | Type | Notes |
| --- | --- | --- |
| `items` | `ItemListEntry[]` | `{ id, config?, name?, version?, passages?, summary?, highlights?, data? }`. `id` keys the row and must be unique; a repeated id shows only its first entry. `data` reaches the extensions untouched |
| `env`, `resolve`, `strategy`, `loaderOptions`, `loaderConfig` | | Passed to every row, as on `<pie-item-summary>`. Every row gets the same objects, so rows share element loads; a host keeps their references stable across renders |
| `locale`, `i18n` | | As on `<pie-item-summary>`. The list's one provider serves its labels, every row and every player |
| `expanded` | `boolean` | Expands every row, unless `expandedIds` is set. A change resets the rows' own toggles. Also an attribute |
| `expandedIds` | `string[]` | Expands the rows with these ids, and takes precedence over `expanded` while set. A change in its contents resets the rows' own toggles; an equal array does not |
| `details` | `ItemListExtension` | The leading column. Default: the entry's `name`, `id` and `version` |
| `actions` | `ItemListExtension` | The top-end corner. Default: empty |
| `highlights` | `ItemListExtension` | Below the summary, outside its clip, so a collapsed row still shows why it matched. Hidden while it renders nothing. Default: the entry's `highlights` |

An entry without `config` needs a `summary`: the row shows it, and an expanded
row keeps showing the whole summary, without a player and without `aria-busy`,
until the host sets `config` on the entry. A host that fetches items on demand
does so on `expanded-changed` and replaces the entry.

An entry's `highlights` is a list of `{ label?, snippets }`, one per matched field,
as a search engine's highlighter returns them. A snippet is an HTML fragment in
which `<mark>` marks a match, so a host configures its engine's highlight tag
as `<mark>`. Only a snippet's text and its marks render, as text nodes and
`<mark>` elements; no other markup reaches the page. A snippet whose text
repeats one shown for an earlier field is dropped, as are empty snippets.
Block elements and `<br>` separate the words on either side, the tail of a tag
cut through at a snippet's start is dropped, and a snippet whose engine
entity-encoded an HTML field is parsed once more, so its markup never shows as
text. TeX shows as source. The
block is a group labelled by the `player.list.highlights` catalog key.

The host chooses the indexed fields its engine highlights: the list shows every
snippet it is given, whatever the `env` role, so a student-facing list leaves
out fields such as rationales and correct responses.

An `ItemListExtension` is one of:

- A custom element tag name. The row creates the element once and sets its
  `entry` property to the entry, again whenever the entry changes; an element
  defined after the row created it receives the entry through its setter once
  it upgrades. A tag name can also be set as the `details`, `actions` or
  `highlights` attribute. A `highlights` element with nothing to show sets
  `hidden` on itself, which hides the block.
- A function `(entry, host) => void | { update?, destroy? }`, which renders
  into `host` and may return a handle, or a promise of one, as a Svelte action
  does. Framework components mount through it. Toggling a row does not re-run
  it. When the entry changes identity, the handle's `update(entry)` takes it in
  place; without `update`, or when the function changes identity, `destroy()`
  runs, `host` is emptied and the function renders again. `destroy()` also runs
  when the row goes away. A promised handle takes the entry that changed while
  it was pending, and one that resolves after its row went away is destroyed.

The list compares extensions by identity, so a host defines each function once,
outside its render. An extension that throws or rejects logs a console error,
dispatches `extension-error` and leaves the rest of the list rendering.

| Event | Detail | Notes |
| --- | --- | --- |
| `expanded-changed` | `{ id, expanded, expandedIds }` | A row's expand button was pressed. `expandedIds` lists the expanded rows among the current `items`, for a host that restores them through `expandedIds` |
| `player-error` | `{ id, part, code, message, recoverable }` | A row's `player-error`, with the entry `id` and the failed `part`, `"item"` or `"passage"`, added. The summary's own event stops at the list |
| `load-complete` | `{ id, part, view }` | A row's item or passage summary rendered, or its player loaded. The summary's own event stops at the list |
| `extension-error` | `{ id, slot, phase, cause }` | A row's `details`, `actions` or `highlights` extension failed to `render`, `update` or `destroy` |
| `framework-error` | `{ kind: "i18n-locale-load", … }` | As on `<pie-item-summary>`, once for the list |

Each row carries its entry's id as `data-pie-item-id`. The expand button is a
disclosure button: `aria-expanded` carries the state, `aria-controls` names the
row's view, its name is the `player.list.expandA11y` label followed by the row's
details, its tooltip switches to `player.list.collapse` while expanded, and
focus stays on it as the player swaps in. A row is `aria-busy` from expanding
until its item's player loads or fails, and its button shows a spinner
meanwhile, static under `prefers-reduced-motion`. An expanded row whose player
failed shows the `player.list.playerError` status, as an alert, below its
summary. The button sticks to the top of the viewport while its expanded row
scrolls past; collapsing scrolls the button back into view when the row's
height change left it above the viewport. Below a list width of 36em the
details stack above the content and the button no longer sticks.

| Custom property | Default | Notes |
| --- | --- | --- |
| `--pie-item-list-clip-height` | `7em` | A collapsed row's summary height |
| `--pie-item-list-sticky-top` | `0px` | The height of a host's sticky header, which the expand button stays below |

The list's colours and type come from the `--pie-*` theme tokens, so a host
wraps it in `<pie-theme>` to bridge its own theme. Rows render in the light
DOM, so a host styles a selected row through `.pie-item-list__row:has(…)` on a
marker its `actions` or `details` extension renders, such as a checked
checkbox. A host with a sticky header sets `--pie-item-list-sticky-top` to its
height.

The list marks no search terms in the summary itself. Pagination, sorting,
selection, keyboard navigation between rows and the empty state stay with the
host, and one that hides passages leaves `passages` out of its entries. The
list renders in the browser only; a server-rendered page shows it once its
script runs.

## Exports

| Entry | Exports |
| --- | --- |
| `@pie-players/pie-item-list` | Registers `<pie-item-summary>` and `<pie-item-list>`. Exports the summary and list types, `PieItemSummaryElement` and `PieItemListElement`. Imports `@pie-players/pie-item-player` by bare specifier, on first expand |
| `@pie-players/pie-item-list/summarize` | `summarizeItem`, `isItemSummary`, `convertSummaryMath`, `bundledSummaries`, `pinnedSummaries` and the summary types. Node-safe |
| `@pie-players/pie-item-list/browser` | The self-contained browser build, with the item player as a chunk ([Loading from a CDN](../../docs/install/cdn.md#item-list-browser-build)) |
