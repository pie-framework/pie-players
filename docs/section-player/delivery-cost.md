# Delivery Cost of Question Runs and Fact Grids

Measured cost of two delivery shapes for short math-fact items, under the `esm`
and `preloaded` strategies: a run of one-question sections, and a page holding a
grid of facts. The numbers come from a repeatable harness, and the page closes
with the pattern each shape recommends and the retention found in the element
code.

Each item has one `math-inline` model with `responseType: "Simple"`, one of the
`non-negative-integers`, `integers` and `fractions` keypads, a prompt such as
`<p>7 + 8</p>`, `expression: "{{response}}"` and one answer validated
symbolically. The run covers 20 questions and the grid 24 facts.

## Method

The device is emulated: Chromium 156 with 4x CPU throttling and Playwright's
Galaxy Tab S4 profile (712×1138 viewport, touch, mobile). Answers are entered
with mouse clicks and typed keys. No physical tablet was measured. Each case ran five times, every run in a fresh browser context, so the
first page has a cold HTTP cache and a second page in the same context a warm
one. Tables give the medians.

- **Interactive** means the response field's editor has attached and laid out:
  MathLive's `math-field` is upgraded, or for math-inline 13.0.7 the MathQuill
  field holds its textarea. The first question and the grid are timed from
  navigation start, and each later question from the host's call that swaps it
  in.
- **Heap and DOM counters** are read after two forced garbage collections, once
  per question, with the answer typed into each question first.
- **Network** counts the requests that reached the network and their encoded
  bytes. A tally ends once no request has been in flight for a second, so it
  includes the fonts an editor fetches after it becomes interactive.

Element versions: `@pie-element/math-inline@13.0.8-next.20261110063142`,
`@pie-element/math-templated@8.0.8-next.20261110063142`, the versions the demos
install from the `next` dist-tag. A remount case under `esm` also measures
`@pie-element/math-inline@13.0.7`, the `latest` dist-tag, which still renders its
response field with MathQuill.

The harness is `packages/section-player/perf/delivery-cost.perf.ts`, driving
the `/perf/question-run` and `/perf/fact-grid` routes of `apps/section-demos`.
`bun run perf:delivery-cost` builds section-demos for production and runs it in
about 35 minutes, writing `report.md` and the raw samples to
`packages/section-player/test-results/delivery-cost/`. `PERF_RUNS`,
`PERF_QUESTIONS` and `PERF_FACTS` change the sample sizes, and
`PERF_MATH_INLINE_VERSION=13.0.7` adds the published-version case.

## Question run

Each question is one item wrapped by `sectionFromItem` and rendered in
`<pie-section-player-splitpane>`, in three host shapes:

- **remount**: a fresh section player per question, each given the host's one
  `ToolkitCoordinator`, as the [integration guide](./integration-guide.md)
  orders it.
- **remount-own**: a fresh section player per question with no host
  coordinator and a new attempt id, so each player's toolkit creates and disposes
  its own.
- **replace**: one section player for the whole run. The host sets `section-id`
  and `section` per question and persists the section it left.

| Case | First question interactive | Later questions interactive | Heap, Q1 → Q20 | DOM nodes, Q1 → Q20 | Listeners, Q1 → Q20 |
| --- | --- | --- | --- | --- | --- |
| `esm`, remount | 1.85 s | 53 ms | 24.8 → 30.3 MB | 745 → 1345 | 762 → 819 |
| `esm`, remount-own | 1.88 s | 55 ms | 24.8 → 30.5 MB | 745 → 1345 | 762 → 819 |
| `esm`, replace | 1.85 s | 52 ms | 24.8 → 30.0 MB | 745 → 1345 | 762 → 819 |
| `preloaded`, remount | 1.41 s | 47 ms | 18.7 → 24.2 MB | 750 → 1350 | 760 → 817 |
| `preloaded`, remount-own | 1.45 s | 42 ms | 18.7 → 24.4 MB | 750 → 1350 | 760 → 817 |
| `preloaded`, replace | 1.28 s | 38 ms | 18.7 → 23.9 MB | 750 → 1350 | 760 → 817 |
| `esm`, remount, math-inline 13.0.7 | 2.02 s | 46 ms | 31.1 → 36.2 MB | 759 → 2285 | 762 → 3883 |

| Strategy | First question, cold | Questions 2–20, cold | First question, warm | First question interactive, warm |
| --- | --- | --- | --- | --- |
| `esm` | 134 requests, 2,022 KB | none | 7 requests, 4 KB | 1.36–1.57 s |
| `preloaded` | 127 requests, 1,751 KB | none | 7 requests, 4 KB | 1.15–1.24 s |
| `esm`, math-inline 13.0.7 | 113 requests, 1,795 KB | none | 8 requests, 5 KB | 1.36 s |

The three shapes cost the same. After the first question each next one is
interactive in 40–60 ms and fetches nothing, and heap, DOM and listener counts
move together across the shapes. The replace shape keeps every visited
section's controller until the coordinator disposes it, which is what restores a
revisited section, and at 20 questions that costs no measurable heap.

The first question carries the whole cost. Under `esm` the cold first question
fetches 59 requests and 612 KB from the page origin (the host app, the section
player and the toolkit), 55 requests and 1,153 KB from `cdn.jsdelivr.net` (the
math-inline package and React), and 20 requests and 257 KB from `unpkg.com`.
Under `preloaded` the element code is same-origin: 107 requests and 1,494 KB,
plus the same 20 from `unpkg.com`. `preloaded` is interactive about 0.4 s sooner
cold.

### First-question download

The math-inline package's own files, cold, per version:

| Part | 13.0.8-next | 13.0.7 |
| --- | --- | --- |
| MathJax core | 310 KB | 246 KB |
| MathJax font data (40 chunks) | 200 KB | 174 KB |
| MathLive | 234 KB | none |
| Controller, with `mathjs`-based validation | 180 KB | 229 KB |
| Shared chunks, holding the React UI, MUI and the keypad | 194 KB (4 files) | 210 KB (3 files) |
| Delivery entry and `package.json` | 5 KB | 4 KB |
| Total | 49 files, 1,123 KB | 47 files, 863 KB |

MathJax is close to half the package in both versions. The keypad shares one
chunk with the MUI-based UI, 173 KB in 13.0.8-next and 168 KB in 13.0.7.

MathLive's KaTeX fonts, 20 files and 257 KB, load from `unpkg.com` under every
strategy, `preloaded` included: the element falls back to a version-pinned CDN
when no font directory is configured, and the player exposes no setting for it.

## Fact grid

24 facts on one page, in two shapes:

- **items**: 24 `math-inline` items, each in its own `<pie-item-player>`.
- **templated**: one `math-templated` item whose markup holds 24 response areas,
  in one `<pie-item-player>`.

| Case | First fact interactive | All facts interactive | All facts, warm | Heap | DOM nodes | Listeners | Cold network |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `esm`, items | 1.77 s | 2.00 s | 1.44 s | 25.3 MB | 1697 | 4676 | 116 requests, 1,766 KB |
| `esm`, templated | 1.85 s | 1.85 s | 1.22 s | 22.1 MB | 1214 | 1363 | 115 requests, 1,752 KB |
| `preloaded`, items | 1.19 s | 1.32 s | 1.18 s | 19.3 MB | 1702 | 4674 | 109 requests, 1,469 KB |
| `preloaded`, templated | 1.17 s | 1.17 s | 0.93 s | 16.0 MB | 1219 | 1361 | 109 requests, 1,459 KB |

One `math-templated` item is the cheaper page, by a small margin: all 24 facts
are interactive about 0.15 s sooner, with 3 MB less heap and a third of the
listeners. Both shapes fetch the same amount, since each loads one element
package of similar size.

`math-templated` scores the item as a whole. `outcome()` returns one score:
the fraction of response areas answered correctly when partial scoring is
enabled, and 0 or 1 when it is not. In evaluate mode the view model carries a
per-area correctness map, so the element can mark each fact, but no per-fact
score or outcome exists.

## Recommended patterns

- **Question run**: any of the three shapes. Pick the one the host's navigation
  needs: replace when a learner may revisit a question and should find it as
  left, remount when each question stands alone. The first question's download
  is the cost to manage. `preloaded` shortens it, and a warm cache shortens both
  strategies.
- **Fact grid**: one `<pie-item-player>` per fact when facts are scored, tried
  or reported individually, at a cost of about 0.15 s and 3 MB on the emulated
  tablet. One `math-templated` item when the page is scored as one unit.

## Retention

The players add no per-question growth. Heap rises about 5 MB over the first ten
questions while element code paths warm up, then about 80 KB per question, most
of it the MathLive retention below. With that released by a click outside the
field after each answer, heap grew 56 KB in total from question 10 to question
30, nearly all of it compiled code, and no player objects accumulated. After
teardown, with each field released, a 5-question run and a 20-question run leave
the same DOM node and listener counts. Heap after teardown stays about 5 MB
above the first question because the loaded element code and its caches outlive
the players.

Two retentions sit in the element code:

- **MathLive 0.110.0**, in math-inline 13.0.8-next (0.111.4, the current
  release, has the same code). When a `math-field` loses focus it registers a
  once-only `click` listener and a once-only `focusin` listener on `document`,
  for its `restoreFocusWhenDocumentFocused` behaviour, and the `click` listener
  keeps the field alive until a click reaches the document. A mouse click on the
  field's content stops at the field, so a run where the learner clicks into
  each field and types keeps every answered field: 32 DOM nodes and 3 listeners
  per question in the table above. The next click anywhere else on the page
  releases all of them. Under Chromium touch emulation the first tap on a field
  does reach the document and releases the earlier fields, so touch input keeps
  only the last one. The fix belongs in MathLive and is proposed in
  [arnog/mathlive#3138](https://github.com/arnog/mathlive/pull/3138): it passes
  the abort signal to those two listeners and cancels the restore when the field
  is disposed. Turning `restoreFocusWhenDocumentFocused` off in the element
  also releases them, at the cost of the field no longer regaining focus when
  the window does.
- **math-inline 13.0.7**: MathQuill's global field registry keeps every field
  for the life of the page, 80 DOM nodes and 164 listeners per question, which
  teardown does not release. 13.0.8 replaces MathQuill with MathLive.

Questions are timed with the answer typed in and no click outside the field,
which is the flow that retains the most.
