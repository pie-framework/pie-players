# @pie-players/pie-item-list

Readable summaries of PIE items for item banks, search results and section
outlines. `summarizeItem` reduces an item to data, and `<pie-item-summary>`
renders it as one list row, with no element code loaded. PIE stands for
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

A `role` other than `"instructor"` strips answers. `resolve(tagName, pkg)`
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
  module takes the prompt rung.

A resolver that always returns `null` turns summarizers off:

```ts
await summarizeItem(item, { role: "student", resolve: async () => null });
```

`isItemSummary(value)` checks a stored summary against schema 1 field by field,
ignoring unknown fields. `<pie-item-summary>` runs the same check on its
`summary` property.

## `<pie-item-summary>`

Importing the package registers `<pie-item-summary>`. The row renders into its
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
| `env` | `Env` | Default `{ mode: "view", role: "instructor" }`. Only `role: "student"` withholds answers |
| `summary` | `ItemSummary` | Optional precomputed summary. Used instead of `config` when `isItemSummary` accepts it, and recomputed from `config` otherwise; answers are stripped again for students |
| `resolve` | `SummaryResolver` | Summarizer lookup, as for `summarizeItem`. Default `bundledSummaries` |
| `locale` | `string` | BCP-47 tag for the row's own labels. Default `en-US` |

| Event | Detail | Notes |
| --- | --- | --- |
| `load-complete` | `{ view: "summary" }` | Once per rendered summary, after math conversion. A new `env` object with the same `role` does not re-render |

Every HTML fragment renders through the players' markup sanitizer. Options
render as a list, with a check mark and a text alternative on correct options
for instructors. Options that carry a `group` (a blank, row or category) render
as nested lists under their group's label, in order of each group's first
option. Manual scoring shows as a badge, and `figure` as an image. TeX
converts to MathML through `texToMathml` from
`@pie-element/shared-math-rendering-mathjax`, which loads only when a summary
holds TeX.
