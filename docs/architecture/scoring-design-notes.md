# Scoring Design Notes

Why item scoring in pie-players is split between the browser and the server,
what the legacy player did, and the session-event rules the PIE API service
scores by. For contributors. The integrator view, with the scoring paths, the
result shapes and the service's rule order, is
[Item Scoring and Rubrics](../item-player/scoring-and-rubrics.md).

## No Item Score in the Player

`<pie-item-player>` returns one outcome per element model and never rolls them
into an item score, because the aggregation depends on state the browser does
not hold: the saved session, manual scores, the partial-scoring mode across the
item, and whether the item is a rubric item. The PIE API service holds all of
it and is the authoritative aggregator for persisted sessions. Elements that
need their own aggregation, such as EBSR's Part A gate, keep it inside their
controller, so an item-level rule never splits them.

Section-level formative delivery aggregates element outcomes by the service's
default policy and records a four-valued correctness instead of a score
([formative delivery contract](../prds/formative-delivery-contract.md)).

## Render and Score Path

1. `makeUniqueTags()` versions the custom element tags in `markup`, `elements`
   and `models`.
2. The loader registers the elements, and the controllers when the strategy
   brings them.
3. `updatePieElements()` iterates `config.elements`, finds the rendered nodes,
   matches each node to a model by `model.id === element.id`, finds or creates
   its session row and calls the controller's `model()`.
4. Elements emit `session-changed` as the learner interacts. The shared renderer
   merges the element's session and filters repeated announcements, and the
   item player forwards the item session container to the host
   ([session management](../item-player/overview.md#session-management)).

`scorePieItem()` in `@pie-players/pie-players-shared/pie` iterates
`config.models`, finds each rendered element by `id` or `pie-id`, looks up the
controller by the element's tag and calls `outcome(model, sessionRow, env)` with
`mode: "evaluate"`. A `player.js` delivery, which is what a hosted player loads,
resolves no controller even when another loader on the page registered one,
because the registry is shared and a registered controller is no evidence that
this player may run it. `provideScore()` calls it keeping a slot for every
model.

## Legacy Player Scoring

The Stencil `<pie-player>` in
[pie-player-components](https://github.com/pie-framework/pie-player-components)
scores through an imperative `provideScore()`:

1. It selects the models: `stimulusItemModel.pie.models` for a stimulus item,
   `pieContentModel.models` otherwise.
2. It finds each rendered element by `id` or `pie-id`.
3. It looks up the controller by the element's `localName`.
4. It calls `controller.outcome(model, session, { mode: "evaluate",
   partialScoring: env.partialScoring })`.
5. It resolves to an array of per-model results, with an `undefined` slot where
   the element, the controller or `outcome()` is missing.

It does not roll the results into an item score either. Its rubric and
complex-rubric support is config and markup orchestration; to `provideScore()`
a rubric model is an ordinary model. `<pie-item-player>` keeps the slot-per-model
contract and passes the player's whole `env` with `mode: "evaluate"`, where
`<pie-player>` passed only the mode and `partialScoring`.

## Session-Event Scoring

The PIE API service keeps a session as an append-only list of events and scores
from them:

- **Save events.** Every save's entries merge into the session's data, oldest
  first. A save is either a response (from a save, score or model request) or a
  controller update: session state a controller's `model()` returned, such as
  shuffled choices.
- **The anchor.** The latest save that is not a controller update is the
  response the session is scored on. A controller update after it does not move
  it.
- **Recorded scores.** A computed auto score is recorded against the anchor,
  any other result against the latest save. The cached auto score is the latest
  one recorded against the current anchor, returned only while its
  `partialScoring` matches the request's.
- **Manual scores.** A manual score holds from the anchor on: the latest one
  given at or after it counts, one given in the same millisecond included, and
  the next response voids it. Without an anchor, the latest manual score
  counts.
- **The no-save zero.** Rule 1 looks at saves of every kind, so a session with
  only a controller update is scored by the later rules.

Rubric items get no auto score because the rubric controllers' scoring
functions are stubs, and the service detects them item-wide, by a `rubric` in
the config or any model whose element name contains `rubric`, so a rubric beside
an auto-scored element blocks the whole item.

The item-wide partial-scoring switch runs before every rule: when every model
has `partialScoring: false`, the service scores, caches and compares with
`env.partialScoring` set to `false`.
