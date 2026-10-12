# Item Scoring and Rubrics

How an item rendered by `<pie-item-player>` gets a score, for hosts deciding
where to score: in the browser with `provideScore()`, or on the server with
`score()`. Each PIE element scores its own response through its controller's
`outcome(model, session, env)`, and the item player returns those outcomes
without rolling them into an item score. Server scoring also covers saved
sessions, manual scores and rubric items. The design history behind these
choices is in [scoring design notes](../architecture/scoring-design-notes.md).

## Scoring Paths

| | `provideScore()` | `score()` |
| --- | --- | --- |
| Runs | Each element controller's `outcome()` in the browser | On the backend, through `backend.delivery` ([backend support](./backend-support.md)) |
| Needs | A player that is not hosted, with controllers loaded: a `client-player.js` bundle under `iife`, the controller modules `esm` loads, or a controller registered with `registerPreloadedElements` | An enabled `backend.delivery` |
| Returns | One slot per model, in `config.models` order; `false` when the item has no models | What the backend's scoring contract returns; the PIE API service returns `{ max, points, partialScoring, type }` |
| Records | Nothing | On the PIE API service, the session's data and its score |

`provideScore()` calls `outcome()` with the player's `env`, `mode` set to
`"evaluate"`. Each slot is the element's session row merged with its outcome
(`score`, `max`, `empty` and whatever else the element returns), or `undefined`
when the model has no rendered element or its controller has no `outcome()`. A
hosted player loads no controllers, so its `provideScore()` returns an
`undefined` slot per model; that includes a player with `backend.delivery`
enabled and `hosted` unset.

A browser that holds the controllers holds the answer key, so a learner-facing
score that must be trusted comes from `score()`
([delivery integrity](../security/readme.md#delivery-integrity)).

## Items, Sessions and Controllers

An item config maps tags to packages and holds one authored model per element
instance:

```ts
{
  markup: "<multiple-choice id=\"mc1\"></multiple-choice>",
  elements: {
    "multiple-choice": "@pie-element/multiple-choice@14.0.3"
  },
  models: [
    { id: "mc1", element: "multiple-choice", ... }
  ]
}
```

The session is an item-level container with one row per element instance:

```ts
{
  id: "session-id",
  data: [
    { id: "mc1", element: "multiple-choice", value: ["choice-a"] },
    { id: "match1", element: "match", answers: [...] }
  ]
}
```

The `id` ties the authored model, the rendered custom element and the session
row together. The response shape inside a row belongs to the element: `value`,
`answers`, `selectedTokens`, a nested `partA` / `partB`, and so on.

A controller exposes:

- `model(model, session, env, updateSession?)`, which builds the delivery model.
- `outcome(model, session, env)`, which evaluates a response.
- `createCorrectResponseSession(model, env)`, for instructor preview.
- `validate(model, config)`, for authoring validation.

Some controller type definitions also declare a `score()` function; neither path
calls it.

## Multi-Element Items

A multi-element item has several `config.models` entries and several session
rows. `provideScore()` returns one outcome per model and leaves the item score
to the host, which defines the aggregation rule explicitly. The PIE API service
aggregates by default as [Persisted API Scoring](#persisted-api-scoring)
describes. Section-level formative delivery aggregates by the same policy and
records a four-valued correctness instead of a score
([formative delivery contract](../prds/formative-delivery-contract.md)).

## Persisted API Scoring

The PIE API service scores a saved session.

![Persisted scoring on the PIE API service: a save or score request saves the posted data and merges every save, then the first rule that applies decides the score: nothing saved, a manual score at or after the latest response, a cached auto score, a rubric item with no auto score, or the element controllers' outcomes aggregated; the service records the score and returns it](../img/item-player-scoring.excalidraw.svg)

A save request and a score request take the same path:

1. The posted `data` is saved as a session event.
2. The session's save events are merged, oldest first, into its current
   `session.data`.
3. When every model in the item has `partialScoring: false`, the service sets
   `env.partialScoring` to `false`.

The first of these rules that applies decides the score:

1. No save: `{ points: 0, max: 1, type: "auto" }` with the message
   `"No data was saved"`.
2. A manual score given at or after the latest save is returned as is, with
   `type: "manual"`.
3. The auto score recorded for the latest save is returned when its
   `partialScoring` matches the request's, unless the request sets
   `skipCached: true`.
4. A rubric item, one whose config has a `rubric` or a model whose element name
   contains `rubric`, gets no auto score: the result carries only the message
   `"No manual score available"`.
5. Otherwise the service sets `env.mode` to `"evaluate"` and calls each element
   controller's `outcome(model, sessionRow, env)`. An outcome carrying an error
   makes the result the message `"Auto-score error"` with the errors.

Outcomes without a `score` do not count. By default the counted outcomes
aggregate as:

| Counted outcomes | `points` | `max` |
| --- | --- | --- |
| One | its `score` | its `max`, or `1` |
| Several, partial scoring on | the mean of `score / max` | `1` |
| Several, partial scoring off | `1` when that mean is exactly 1, otherwise `0` | `1` |

Example: two auto-scored elements, one with full credit and one with none:

```ts
// partialScoring: true
{ points: 0.5, max: 1, type: "auto" }

// partialScoring: false
{ points: 0, max: 1, type: "auto" }
```

The service records the score. A score request returns it, rescaled when
`env.maxPoints` is above 1: `points` becomes `round(points / max * maxPoints)`
and `max` becomes `maxPoints`. `env.partialScoring` defaults to `true` on the
service.

## EBSR

The two-part selected-response element is `@pie-element/ebsr`, spelled EBSR
throughout PIE. It renders two multiple-choice-like parts as one PIE model and
one custom element, with a nested session:

```ts
{
  id: "ebsr1",
  element: "ebsr",
  value: {
    partA: { id: "partA", value: ["..."] },
    partB: { id: "partB", value: ["..."] }
  }
}
```

The controller scores each part and returns one outcome for the whole model.

| Partial scoring | `max` | Score |
| --- | --- | --- |
| Off | 1 | `1` only when Part A and Part B are both fully correct, otherwise `0` |
| On | 2 | Part A gates all credit: both correct `2`; Part A correct and Part B not fully correct `1`; Part A not fully correct `0`, whatever Part B holds |

A generic two-element item aggregates differently; EBSR's rule lives inside its
controller and is its scoring contract.

## Rubric and Manual Scoring

Rubric elements describe manual scoring criteria and their visibility; they do
not score a learner's response.

- **Simple rubric:** exposes `model()` and `validate()`. Instructors receive the
  normalized rubric model and students an empty one. It validates point
  descriptors and has no meaningful `outcome()`.
- **Multi-trait rubric:** prepares scale and trait display data and controls
  whether students see the rubric. Its scoring functions are stubs:
  `getScore()` returns `0` and `outcome()` returns `{ score: 0, empty: true }`.
- **Complex rubric:** wraps `simpleRubric`, `multiTraitRubric` and `rubricless`,
  switching model shape and visibility on `rubricType`. Its scoring is the same
  stub.

The PIE API service treats a whole item as a rubric item when its config has a
`rubric` or any model's element name contains `rubric`, and scores it only
manually (rule 4 above).

## Partial Scoring

Most element controllers decide partial scoring with a shared rule:

- `model.partialScoring === false` turns it off.
- `env.partialScoring === false` turns it off.
- Otherwise it takes the element's own default, or `true` when the element sets
  none.

Element rules still differ: multiple-choice in radio mode is dichotomous, EBSR
gates on Part A, and elements that need manual scoring return `0`. On the PIE
API service the item-wide switch in step 3 of the scoring path runs before any
rule.

## Practical Guidance

- **Persisted learner attempts:** score on the server with `score()`. The PIE
  API service accounts for save events, manual scores, cached auto scores,
  rubric items and the partial-scoring mode.
- **Local demos and previews:** call `provideScore()` for per-element outcomes
  from the browser, or call an element's `outcome()` directly.
- **Multi-element items:** the item player does not sum scores; define the
  aggregation rule.
- **EBSR:** score it as one element. Splitting Part A and Part B into
  item-level aggregation breaks its contract.
- **Rubric, multi-trait-rubric, complex-rubric, drawing-response and similar
  manually scored interactions:** expect a manual score.
