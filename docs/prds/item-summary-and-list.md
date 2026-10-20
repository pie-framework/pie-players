# Item Summaries And Item Lists

Status: Draft, 2026-10-13

Implementation status: slices 1 to 5 have landed in
[`@pie-players/pie-item-list`](../../packages/item-list/README.md):
`summarizeItem`, `isItemSummary`, both resolvers with `bundledSummaries` as the
default, `<pie-item-summary>` with its summary and player views and the
page-wide scheduler, `<pie-item-list>`, and `convertSummaryMath` for backend
precompute. The bundled set covers 27 element
packages, Host R's previews included; it lives in pie-players until ng
publishes `./summary` entries, which then replace it.
pie-elements-ng owns the descriptor type and the per-element `./summary`
entries; pie-players owns item-level summarization, the bundled summarizer set
and the custom elements. Wiring precompute into the PIE API backend is
optional and unscheduled.

Owner: PIE Players maintainers

This PRD defines how a host shows many PIE items at once — an item bank, a
search result, a section outline — without mounting a full player per row. It
supersedes the internal mini-players design, which kept one preview renderer per
element type inside the reference app. Here each element describes its own
content as data, the players supply the fallback, the rendering and the loading
mechanics, and no host maintains per-element renderers.

Related architecture:

- [Print player](../../packages/print-player/README.md) — the precedent for a
  dedicated player over a per-element view entry and a resolver hook
- [Item player overview](../item-player/overview.md) and
  [Math rendering](../item-player/math-rendering.md)
- [Migration from the legacy PIE players](../item-player/migration-from-pie-player-components.md)
- [Consumer API dependencies](../integrations/consumer-api-dependencies.md) —
  Hosts B and R

## Problem

Instructors and authors scan lists of items to choose, review and arrange them.
The three ways hosts render those lists today each fail one way:

- **Metadata only** (identifier, type, version, source). Fast, and unreadable to
  someone choosing between items.
- **Stripped prompt text.** Drops layout, images and math, and shows nothing for
  items whose content lives outside `prompt`: cloze interactions, passages, and
  multi-part items whose prompts sit on child models.
- **One full player per row.** Every row loads element bundles and runs
  controllers and session setup. Hosts mount rows behind a visibility queue with
  a concurrency cap to keep the page usable, clip rows to a fixed height, and
  wait on the player's load event before sizing them.

Observed shapes:

- **Host B** (legacy item bank) mounts one legacy `<pie-player>` per row in
  instructor view with correct responses shown, behind a scroll-driven queue
  that advances on `load-complete` and `player-error`.
- **Host R** (reference app) keeps 25 per-element preview components and a
  fallback. They read the first model only, and render math only when a global
  math renderer happens to be on the page.
- **The authoring and ingestion host** lists bank items as metadata tables and
  previews one item or section at a time through the section player.

No PIE package provides a cheap, readable view of an item.

## Goals

- An element describes its item content as plain data, computed without DOM,
  controllers or sessions.
- Every item gets a readable summary, including items whose elements publish no
  summary.
- A row renders from its summary alone, loading no element code, and upgrades in
  place to the full player on demand.
- One path serves Host B, Host R and the authoring host without per-host
  renderers.
- The whole feature runs in the browser from the item config the host already
  holds. Server precompute is an opt-in optimization.
- Element version resolution for summaries is a host hook, so a host can follow
  sanctioned or pinned versions.

## Non-Goals

- Search, filtering, sorting, paging, selection and persistence of list state.
  Hosts own them.
- Student-facing delivery. Summaries serve instructors and authors.
- Responses, sessions and scores. A summary describes content.
- A host-extensible per-element renderer registry. Elements own their summaries.
- Changes to the IIFE path or to the legacy `pie-player-components`.

## Package And Export Ownership

- **`@pie-element/shared-types`** (pie-elements-ng): `ElementSummary`,
  `SummaryOption`, `SummaryPart`, `SummaryOptions` and `SummarizeFn`. This is the
  one definition. pie-players imports it, as `players-shared` already imports
  ng's shared math package.
- **Each ng element**: `./summary`, a Node-safe ES module exporting `summarize`,
  and `./browser/summary`, its self-contained browser build. The pair follows
  `./print` and `./browser/print`. An element without a summary omits both.
- **`@pie-element/shared-math-rendering-mathjax`** (pie-elements-ng): a
  `./mathml` subpath exporting `texToMathml(html)`, which uses the macros and
  delimiters delivery uses. The TeX dialect belongs to that package; a second
  copy of its macro table in pie-players would drift.
- **`pie-item-list`**, a new package in the `@pie-players` scope, which owns:
  - `.` registers `<pie-item-summary>` and `<pie-item-list>` as a side effect,
    as `pie-item-player` does. Its entry and lazily loaded chunks are ES
    modules that import nothing by bare specifier, so a host can load the entry
    as a module script from a public CDN with no build step.
  - `./summarize` exports `summarizeItem`, `ItemSummary` and the resolvers. It
    is Node-safe, registers nothing and touches no DOM.
  - The bundled summarizer set, an internal chunk that the default resolver
    imports lazily. It is not a public export.

`<pie-item-summary>` mounts `pie-item-player` by tag for the expanded view, as
the section player does, so `pie-item-player` reaches hosts as a dependency.

## Contract Shape

### Element summary

```ts
// Documentation sketch only.
interface SummaryOptions {
  /** Gates `answer` and `correct`; `student` withholds both. */
  role: "student" | "instructor";
}

type SummarizeFn = (model: unknown, options: SummaryOptions) => ElementSummary;

interface ElementSummary {
  /** HTML, unsanitized. TeX stays as authored. */
  prompt?: string;
  /** Sub-prompts in document order: blanks, rows, a multi-part element's parts. */
  parts?: SummaryPart[];
  /** Choices, dropdown entries, draggable tokens, in authored order. */
  options?: SummaryOption[];
  /** HTML, instructor only: the correct response stated as content. */
  answer?: string;
  /** One representative image for the row. */
  figure?: { src: string; alt?: string };
  /** Audio and video the element plays, by reference. */
  media?: { kind: "audio" | "video"; src?: string; title?: string }[];
  /** A person scores this element. */
  manualScoring?: boolean;
}

interface SummaryPart {
  id?: string;
  prompt?: string;
  options?: SummaryOption[];
  answer?: string;
}

interface SummaryOption {
  id: string;
  /** HTML. */
  label: string;
  /** Instructor only. */
  correct?: boolean;
  /** The blank, row or category the option belongs to. */
  group?: string;
}
```

The vocabulary follows QTI interaction terms: prompt, choices, correct response.
`summarize` is pure and deterministic. It does no I/O, reads no clock or random
source, and never shuffles: options keep authored order whatever the model's
shuffle setting. It returns HTML strings, and the sink sanitizes them.

### Item summary

```ts
// Documentation sketch only.
interface ItemSummary {
  schema: 1;
  /** Item markup outside every element tag, as HTML. */
  stem?: string;
  entries: ItemSummaryEntry[];
}

interface ItemSummaryEntry {
  /** The model `id`, which is the element's `id` in markup. */
  id: string;
  /** Package name, without version. */
  pkg: string;
  source: "summary" | "prompt" | "label";
  /** Display name derived from the package: "Multiple choice". */
  label: string;
  summary: ElementSummary;
}

type SummaryResolver = (
  tagName: string,
  pkg: string,
) => Promise<SummarizeFn | null>;

function summarizeItem(
  config: ItemConfig,
  options: SummaryOptions & { resolve?: SummaryResolver },
): Promise<ItemSummary>;
```

### Fallback ladder

Each element in the item takes the first rung that yields content:

1. **Summary.** The resolved `summarize`, when it returns a non-empty summary. A
   summarizer that throws counts as absent and logs one console warning per
   package.
2. **Prompt.** `model.prompt`, when `promptEnabled !== false` and the prompt
   holds text or an image once tags and whitespace are stripped. Failing that,
   the prompts of the model's direct object-valued children in key order, which
   covers multi-part elements such as EBSR's `partA` and `partB`.
3. **Label.** The display name alone. Label entries are dropped when any other
   entry in the item has content; an item whose entries are all labels shows
   its labels.

`summarizeItem` walks `config.markup` in document order. Markup outside element
tags becomes `stem`. Each element tag maps to its model by `id`. A model with no
tag in the markup is skipped, because delivery does not render it either. An
item without markup falls back to model array order. `teacherInstructions` and
`rationale` never appear: a summary shows what the learner sees, plus answers
for instructors.

A passage element summarizes as its title plus an excerpt. A host that holds a
passage separately from its item renders it as a second summary, and
`<pie-item-list>` places it above the item.

### Version resolution

The resolver hook matches the print player's `resolve(tagName, pkg)`, where
`pkg` carries the version from the item's `elements` map. It returns a
summarizer, or `null` for the prompt rung. Two resolvers ship:

- **`bundledSummaries`** (default) ignores the version and looks the package up
  in the bundled summarizer set. The set loads in one request per page, and
  set bumps follow the preloaded-set rule: every summarizer moves to npm
  `latest` together.
- **`pinnedSummaries(loaderOptions)`** imports `./browser/summary` at the
  pinned version from the CDN the item player's `esmCdnUrl` and
  `esmCdnProvider` name, deduplicated per URL across the page. A version that
  predates its element's `./summary` drops to the prompt rung; a transient
  CDN failure does too, for that row only. The PIE API
  backend rewrites `elements` to sanctioned versions on item read, so this
  resolver follows sanctioned versions with no extra configuration.

A host with its own version policy writes a resolver.

The default is a deliberate trade: one request per page, at the cost of a
summary computed by a newer summarizer than the element the expanded view
renders. Summarizers read model fields that stay stable across versions, and
each one is tested against fixtures of the oldest model shape it accepts. A
host that needs exact agreement uses `pinnedSummaries`.

### `<pie-item-summary>`

The row element. It renders one item, and hosts keep their own list, card and
expand chrome around it.

| Property | Type | Notes |
| --- | --- | --- |
| `config` | `ItemConfig` | Required |
| `env` | `Env` | Default `{ mode: "view", role: "instructor" }`. `role` gates answers in both views. The whole object passes to the player, so keys such as `@pie-element.lockChoiceOrder` reach controllers unchanged |
| `expanded` | `boolean` | Default `false`. `true` mounts the full player |
| `strategy` | `"iife" \| "esm" \| "preloaded"` | The player's loading strategy, passed unchanged. Default `iife` |
| `loaderOptions` | item-player `loaderOptions` | Passed to the player unchanged |
| `resolve` | `SummaryResolver` | Default `bundledSummaries` |
| `summary` | `ItemSummary` | Optional precomputed summary; see Server precompute |
| `locale` | `string` | BCP-47 tag for the row's own labels. Default `en-US` |

| Event | Detail | Notes |
| --- | --- | --- |
| `load-complete` | `{ view: "summary" \| "player" }` | Same name as `pie-item-player` and the legacy player, so existing listeners carry over. Fires once per view, after math conversion |
| `player-error` | `{ code, message, recoverable }` | The item player's shape, re-dispatched. Also fires for a load timeout, with `recoverable: true` |

**Summary view** (`expanded` is `false`). The summary renders as sanitized HTML
through the players' markup sanitizer. Options render as a list. For
instructors, correct options carry a check mark with a text alternative. A badge
marks manual scoring, and `figure` renders as an image. No element code loads.

**Player view** (`expanded` is `true`). The row mounts `pie-item-player` with
`config`, `env` and `loaderOptions`, and sets `addCorrectResponse` when `role`
is `instructor`. The summary stays visible until the player's `load-complete`
and then swaps in place, so the row never collapses to empty. Every load has a
timeout, which ends in `player-error` with the summary still showing.
Collapsing unmounts the player; a later expand reuses the page's registered
elements.

**Scheduling.** Player loads are scheduled page-wide inside the element:

- A row mounts its player only near the viewport.
- Rows that become visible together register their elements in one aggregated
  load, the pattern `aggregateElements` and `ensureRegistered` already provide.
  `pie-item-player` exports it as `preloadItemElements`, built from the
  player's own backend configuration, so the aggregated load and each player's
  load resolve the same bundles.
- Concurrent player mounts are capped, so expanding every row loads them
  progressively.

The scheduler is built in because the state it needs (visibility and in-flight
loads) is per page, and a helper wired by each host is an integration step every
host has to get right. Host B's queue is deleted on adoption, with nothing put in
its place.

### `<pie-item-list>`

A composition of `<pie-item-summary>` rows for hosts with no list chrome of their
own.

```ts
// Documentation sketch only.
interface ItemListEntry {
  id: string;
  config: ItemConfig;
  name?: string;
  version?: string;
  passage?: ItemConfig;
  summary?: ItemSummary;
  /** One per matched field; `<mark>` marks a match in each snippet. */
  highlights?: { label?: string; snippets: string[] }[];
  /** Host data, passed through to the extension points untouched. */
  data?: unknown;
}

type ItemListExtension =
  | string // custom element tag name; receives the entry as its `item` property
  | ((
      entry: ItemListEntry,
      host: HTMLElement,
    ) => void | { update?(entry: ItemListEntry): void; destroy?(): void });
```

- Properties: `items: ItemListEntry[]`, plus `env`, `loaderOptions` and
  `resolve`, which pass through to each row. `expanded` sets every row and
  `expandedIds` the rows it names; a change to either resets per-row overrides,
  and `expandedIds` compares by contents, so a host re-rendering an equal array
  keeps them. `details`, `actions` and `highlights` take an `ItemListExtension`
  each.
- The list owns one i18n provider, or takes the host's through `i18n`, and
  passes it to every row, which passes it to its player. One provider per list
  keeps a locale change to one catalog load, and the player's chrome follows
  the list's locale.
- `details` renders in the row's leading column. By default it shows `name`,
  `id` and `version`. `actions` renders in the row's top-end corner and is empty
  by default: preview, select, edit, copy and delete are host actions.
- The entry's `highlights` render below the summary, outside its clip. The list
  marks no search terms in the summary itself: a host's search engine already
  returns match snippets, configured to mark matches with `<mark>`. The list
  renders only each snippet's text and its marks, as text nodes and `<mark>`
  elements, so snippet HTML never reaches the page and no host sanitizes it. A
  snippet repeating one shown for an earlier field is dropped, since engines
  return the same text for a field and its subfields. The `highlights` extension
  replaces the built-in block for a host with its own rendering, as `details`
  does. The name follows the search engines' highlight field; `matches` would
  shadow `Element.matches()` on the list element.
- A function extension renders into `host` and may return a handle with
  `update(entry)` and `destroy()`, the shape of a Svelte action. Framework
  components (Svelte, Vue, React) mount through it and take a changed entry
  through `update`, so the forms cover tag names, DOM-returning functions and
  framework components.
- Collapsed, the passage shows its first line and the item's summary is clipped
  to `--pie-item-list-clip-height` with a fade, so a long passage never hides
  the item. The row's expand button removes both clips and mounts the players,
  so one control does both.
- The expand button is sticky within its row, below `--pie-item-list-sticky-top`,
  so a tall expanded row can be collapsed without scrolling back; collapsing
  scrolls the button into view.
- `expanded-change` fires with `{ id, expanded, expandedIds }`. Row `player-error` events
  bubble with the entry `id` added. Row `load-complete` events bubble unchanged;
  each row carries its entry's `id` as `data-item-id`.

### Math

Summaries carry TeX as authored. A row converts it to MathML with `texToMathml`
using MathJax's TeX input and MathML output, with no CHTML fonts and no layout
pass. The converter loads once per page, on the first row containing TeX
(about 90 KB gzipped), and costs 0.16 ms per expression as measured in Node.
HTML without TeX delimiters skips conversion, so a summary converted on a server
loads no converter. If the converter fails to load, the row shows the TeX
source.

Chromium's MathML Core omits `menclose`, which `\cancel`, `\boxed` and long
division produce. A post-pass in `./mathml` rewrites them, next to the existing
elementary-math rewrite.

### Server precompute

`./summarize` and `./mathml` are Node-safe, so a backend can compute
`ItemSummary` on item write and serve it with the item. A row uses a summary
only when the host passes one through `summary`, and never fetches one. This
path is off by default, and nothing in the browser path depends on it.
`convertSummaryMath` converts a summary's TeX to MathML before storage, so a
row showing it loads no converter. The backend stores the instructor summary;
the row strips answers for students.

## Host Fit

### Host B

A Vue 2 item bank on webpack 4. Each row mounts the legacy `<pie-player>`,
registered by the `@pie-api/pie-api-components` bundle (which pins
`@pie-framework/pie-player-components`) and loaded as a module script from a
public CDN at a version the host chooses at runtime. Adoption:

- `<pie-item-summary>` replaces `<pie-player>` inside the host's card, and the
  card's existing expand control drives `expanded`. The visibility queue is
  deleted.
- `config` and `env` carry over unchanged, `@pie-element.lockChoiceOrder`
  included. The host's correct-response default becomes `role: "instructor"`.
  `loaderOptions.bundleHost` replaces both `bundleHost` and `bundleEndpoints`;
  the latter has no equivalent, as the
  [migration guide](../item-player/migration-from-pie-player-components.md#property-mapping)
  records.
- `player-error` detail changes from a string to `{ code, message, recoverable }`.
  The markup sanitizer is on by default in both views.
- The package loads as a CDN module script, the way the host already loads
  `pie-api-components`. Webpack 4 cannot parse the `dist`'s optional chaining
  unless the host transpiles the package, and the module-script path avoids the
  host build entirely.
- Its items pin legacy element versions that have no `./summary`, so the host
  stays on `bundledSummaries`, where current summarizers read legacy models.

### Host R

Host R's own list component becomes `<pie-item-list>`. Its per-row collapse
state, passage above the item, details and actions slots and search-match
snippets map onto the composition directly, the snippets as entry `highlights`. Its
tag-name extension currently receives the item as a JSON `data-item` attribute;
under `<pie-item-list>` it receives the entry as an `item` property. The 25 preview components are the seed for ng `./summary`
ports and are deleted once those land, which keeps the reference app
representative of what other hosts get.

### The authoring and ingestion host

A SvelteKit host already on `@pie-players` ESM, not yet in the consumer pad. It
can place `<pie-item-summary>` in its bank tables' item column, or move a page
to `<pie-item-list>` with row selection as a `details` extension. It holds
configs before publishing, so it can also precompute summaries at ingestion.

## Compatibility

- Element runtime and controller contracts: unchanged. `./summary` is a new
  optional entry, and an element without one gets the prompt rung.
- Versioned `pie-*--version-*` tags: untouched. `pie-item-summary` and
  `pie-item-list` are unversioned player tags, like `pie-item-player`.
- Contract attributes: not synthesized or rewritten. Entries keep model `id`s
  exactly as authored.
- `pie-item-player`: consumed through `config`, `env`, `strategy`,
  `loaderOptions`, `addCorrectResponse`, `load-complete` and `player-error`,
  plus the new `preloadItemElements` export.
- Section and assessment state, persisted sessions: untouched.
- Host-facing wire data: `ItemSummary`, when precomputed.

## Data Ownership And Host Responsibilities

PIE owns:

- Summary derivation, the fallback ladder and the summarizer set.
- Sanitization and math conversion at the render sink.
- Player mounting, scheduling and load timeouts.

Hosts own:

- The item list itself: query, paging, search, selection and persistence of
  expanded state.
- Row actions and what they do.
- Element version policy beyond the two shipped resolvers.
- Storage of precomputed summaries, if they precompute.
- Identity, authorization and product policy.

## Serialization And Versioning

`ItemSummary` is wire-facing only when precomputed.

- `schema: 1` versions the contract. `isItemSummary` validates a summary
  field by field, and `<pie-item-summary>` recomputes one that fails.
- Unknown fields are ignored. A summary with an unknown `schema` is discarded
  and recomputed in the browser.
- Elements version their summarizers with their packages. No migration exists,
  because summaries are derived data and recomputable at any time.
- Round-trip fixtures: a summary computed in Node equals the summary computed
  in the browser for the same config and resolver.

## Accessibility

- The summary view is static content. Options render as a list, and the correct
  marker carries a text alternative, so meaning never rides on color or the
  glyph alone.
- Math renders as MathML, which screen readers read natively.
- The expand control in `<pie-item-list>` is a button with `aria-expanded`,
  `aria-controls` naming the view and `aria-describedby` naming the row's
  details, so each button announces which item it expands. The view swap keeps
  focus on that button, and the row is `aria-busy` while its player loads, with
  a spinner in the button.
- A row's search matches are a group labelled by a catalog string, with matches
  as `<mark>` elements.
- The fade, the view swap and the spinner do not animate under
  `prefers-reduced-motion`.
- Whether Chromebooks ship a math font that renders native MathML acceptably is
  unchecked; see Open Questions.

## Standards Or Adapter Impact

The descriptor uses QTI interaction vocabulary so a future adapter can map it
directly. No adapter consumes it.

## Test Plan

- Per-element summarizer fixtures in pie-elements-ng, against current and
  oldest-accepted model shapes, including role gating: a `student` summary
  holds no `answer` and no `correct`.
- The fallback ladder: `promptEnabled: false`, an image-only prompt, EBSR child
  prompts, label entries dropped and kept, markup order, untagged models
  skipped, an item with no markup, and a throwing summarizer.
- Sanitization at the sink: script and event-handler content in a prompt, an
  option label and `answer`.
- Math: conversion, the `menclose` post-pass, skipping when there is no TeX, and
  showing source when the converter fails to load.
- Player view: the summary stays until `load-complete`, a timeout ends in a
  recoverable `player-error`, and `env` reaches the player unchanged.
- Scheduling: the concurrency cap under expand-all, mounting only near the
  viewport, and one aggregated registration per visibility batch.
- Packaging: `./summarize` and `./mathml` import in Node with no DOM, the `.`
  `dist` has no bare imports, and `custom-elements.json` and `api-report/` are
  current.
- Round-trip: Node and browser summaries are equal for the fixture items.

```sh
bun run typecheck
bun run test
```

Also run the [high-value checks](../../AGENTS.md#high-value-checks) for the new
custom elements and export boundary.

## Rollout And Release Notes

- Changeset required: yes, for the new package and for each ng element that
  adds `./summary`.
- Slices, each independently useful:
  1. The descriptor type, `summarizeItem` with the prompt and label rungs, and
     the summary view with sanitizer and math conversion. Every item already
     gets a prompt or label row.
  2. The first summarizers: passage, then the cloze family (drag-in-the-blank,
     inline-dropdown, explicit-constructed-response, math-templated), whose
     content the prompt rung misses. Then the remaining Host R previews, by
     element.
  3. The player view and scheduling. Host B can adopt from here.
  4. `<pie-item-list>` with `details`, `actions` and `highlights`. Host R
     adopts and deletes its previews.
  5. Optional: backend precompute.
- `summarizeItem` also improves the print player's missing-element fallback,
  since most elements publish no print view. That is a separate change.
- Documentation: the package README, and pad rows as each host adopts.
- Release risk: low. The package is new and every entry is additive.

## Open Questions

- Should an instructor be able to hide answers without switching `role`, for
  example when projecting items to a class?
- Do hosts need to tune the scheduler's concurrency cap and viewport margin, or
  are fixed defaults enough?
- Host B also mounts legacy authoring and print elements that register through
  `window.pie`. Can the player view's IIFE loading run safely beside them on one
  page?
- Do Chromebooks ship a math font that renders native MathML acceptably?
- Should `figure` be the first image in the content, or nominated by the
  summarizer?
