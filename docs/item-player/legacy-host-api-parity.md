# Legacy Host API Parity

This note compares host-facing behavior between the current
`@pie-players/pie-item-player` package and two older surfaces that are easy to
conflate:

- **Open-source legacy player**:
  `../pie-player-components`, published as
  `@pie-framework/pie-player-components`, with `<pie-player>` and
  `<pie-author>`.
- **Legacy API player**:
  `../../kds/pie-api-components`, with `<pie-api-player>`. This component
  imports `@pie-framework/pie-player-components`, renders an inner
  `<pie-player>`, and delegates item/session/scoring calls to
  `../../kds/pie-api-aws`.

The current package replaces the open-source legacy browser player from a
rendering point of view, but many hosts historically integrated through the API
player instead. Parity work needs to be explicit about which host contract is
being matched.

## Current Item Player

Current package:

- `packages/item-player/src/PieItemPlayer.svelte`
- `packages/item-player/src/types.ts`
- `packages/players-shared/src/components/PieItemPlayer.svelte`
- `packages/players-shared/src/pie/scoring.ts`

The host uses `<pie-item-player>` by setting `config`, `session`, `env`, and
`strategy`, then listening for:

- `load-complete`
- `session-changed`
- `player-error`
- `model-updated`
- `bundle-retry-status` for IIFE retry telemetry

The only imperative method on the current custom element is `focusFirst()`.
There is no public `provideScore()`, `score()`, `validateModels()`,
`updateElementModel()`, `reset()`, or ready promise on the element.

The current player is therefore primarily a render, controller-model, and
session-forwarding host. It can populate correct-response sessions with
`add-correct-response`, but it does not expose scoring as a first-class element
API.

## Open-Source Legacy Player

Relevant files:

- `../pie-player-components/src/components/pie-player/pie-player.tsx`
- `../pie-player-components/src/components/pie-author/pie-author.tsx`
- `../pie-player-components/src/components.d.ts`
- `../pie-player-components/src/rubric-utils.ts`

The open-source legacy delivery element is `<pie-player>`.

Host inputs include:

- `config`
- `session`
- `env`
- `hosted`
- `bundleHost`
- `bundleEndpoints`
- `disableBundler`
- `reFetchBundle`
- `addCorrectResponse`
- `showBottomBorder`
- `renderStimulus`
- `allowedResize`
- `externalStyleUrls`
- `customClassname`
- `containerClass`
- `passageContainerClass`
- `baseHeadingLevel`

Host events include:

- `load-complete`
- `session-changed`
- `player-error`
- `responseCompleted` (documented as TODO-level support)

Imperative delivery methods include:

- `provideScore(): Promise<false | any[]>`
- `updateElementModel(update: PieModel): Promise<void>`

`provideScore()` is local browser scoring. It:

1. Selects `stimulusItemModel.pie.models` for stimulus items or
   `pieContentModel.models` for regular items.
2. Finds the rendered element by `id` or `pie-id`.
3. Looks up the controller by the rendered element's `localName`.
4. Calls `controller.outcome(model, session, { mode: "evaluate",
   partialScoring: this.env.partialScoring })`.
5. Returns an array aligned to the models being scored.

It does **not** aggregate a multi-element item into one item score. Missing
elements, controllers, or `outcome()` functions can produce `undefined` slots.

The open-source legacy authoring element is `<pie-author>`.

Important host-facing author APIs include:

- `config`
- `configSettings`
- `addPreview`
- `addRubric`
- `defaultComplexRubricModel`
- `imageSupport`
- `uploadSoundSupport`
- `validateModels()`
- `addRubricToConfig()`
- `addMultiTraitRubricToConfig()`
- `modelLoaded`
- `modelUpdated`

The author also performs rubric and complex-rubric orchestration, including
adding missing rubric markup and toggling complex-rubric models when rubric
settings change.

## Legacy API Player

Relevant files:

- `../../kds/pie-api-components/src/components/pie-api-player/pie-api-player.tsx`
- `../../kds/pie-api-components/src/clients/player.ts`
- `../../kds/pie-api-aws/packages/services/src/services/Player.service.ts`
- `../../kds/pie-api-aws/packages/services/src/services/SessionEvent.service.ts`
- `../../kds/pie-api-aws/packages/services/src/controller/PieControllerExecutor.ts`

The API element is `<pie-api-player>`. It is not just a rendering wrapper. It
owns API-backed item/session loading, autosave, server-side model refresh, and
server-side scoring.

Host inputs include:

- `token`
- `itemId`
- `sessionId`
- `assignmentId`
- `env`
- `initialMode`
- `initialRole`
- `preview`
- `host`
- `customConfig`
- `overrides`
- `optimize`
- `renderStimulus`
- `allowedResize`
- `bundleEndpoints`
- `reFetchBundle`
- `externalStyleUrls`
- `customClassname`
- `customModels`
- `customPassageModels`
- `customMarkup`
- New Relic and retry controls such as `exceptions`, `trackPageActions`,
  `recordScreen`, `maxRetryAttempts`, and request timeout/delay settings.

Host events include:

- `session-created`
- `sessionSaved`
- `saveSessionError`
- `api-player-error`
- `model-reload`
- `recordingStarted`

Imperative API-player methods include:

- `score(disablePartialScoring?: boolean): Promise<any>`
- `saveSession(): Promise<void>`

`<pie-api-player>` renders an inner `<pie-player>` with `hosted={!preview}`.
In normal non-preview mode, the inner open-source legacy player receives
server-processed models and the API player handles session persistence. It
listens for `session-changed` from the inner player and debounces
`saveSession()`.

The API player's `score()` method calls `PlayerApiClient.score(...)`, which
posts `sessionId`, current session `data`, `env`, and optional `overrides` to
the configured score endpoint. The browser component itself does not compute
the score.

Server scoring in `pie-api-aws`:

1. Flattens save events into the current `session.data[]`.
2. Returns manual scores before auto scores when manual scoring exists.
3. Reuses cached auto scores when the cached `partialScoring` mode matches,
   unless `skipCached` is set.
4. Returns "No manual score available" for rubric items that have no manual
   score.
5. Forces `env.mode = "evaluate"` before invoking controller outcomes.
6. Calls controller `outcome(model, sessionRow, env)` on the server.
7. Formats the returned element outcomes into a `SessionAutoScore`.

Default API aggregation differs from open-source `provideScore()`:

- One scored outcome is returned directly as `{ points: score, max }`.
- Multiple scored outcomes are normalized and averaged as
  `sum(score / max) / count`, with final `max = 1`.
- With `partialScoring: false`, the normalized score collapses to `1` only when
  every scored outcome is full credit; otherwise it returns `0`.
- KDS MPI items have a special max-score path when partial scoring is disabled.

## Parity Gaps

| Host capability | Open-source legacy | Legacy API player | Current `<pie-item-player>` | Gap |
| --- | --- | --- | --- | --- |
| Local browser scoring | `provideScore()` returns per-model outcomes. | Uses inner `<pie-player>` but exposes API `score()`, not `provideScore()`. | No element method; `scorePieItem()` exists only in shared package. | Add a host method if matching open-source legacy. |
| Rolled-up score | Not provided by `<pie-player>`. | `score()` returns API-formatted `SessionScore`. | Not provided. | Add only if matching API-player semantics or introduce a clearly named new API. |
| Persisted scoring | Not provided. | Server-backed `score()` with manual score, cache, rubric, and aggregation rules. | Not provided. | Requires API integration or a separate adapter, not just controller calls. |
| Session persistence | Host-owned. | Autosaves on `session-changed`; emits `sessionSaved` / `saveSessionError`. | Host-owned; forwards normalized `session-changed`. | Current item player does not replace API persistence. |
| Stimulus config | Accepts `{ pie, passage }`, `renderStimulus`, `allowedResize`. | Loads stimulus responses and passes them through to inner `<pie-player>`. | Top-level custom element validates only root `{ markup, elements, models }`; shared renderer has `passageConfig` but it is not exposed. | Direct stimulus config parity is missing. |
| Authoring validation | `<pie-author>.validateModels()`. | API author builds on legacy author. | No public `validateModels()`. | Missing if current author mode is intended to replace `<pie-author>`. |
| Author model lifecycle | `modelLoaded`, `modelUpdated`. | API author listens to legacy author events. | Only `model-updated`; no `modelLoaded`. | Event naming and lifecycle differ. |
| Preview model update | `updateElementModel(update)`. | API author/preview flow uses legacy update behavior. | No public method. | Missing imperative preview API. |
| Rubric helpers | `addRubricToConfig()`, `addMultiTraitRubricToConfig()`, complex-rubric toggles. | API author imports legacy rubric utilities. | Shared `addRubricIfNeeded()` exists but is not wired into the player; no public helpers. | Rubric authoring parity is incomplete. |
| Loader controls | `bundleHost`, `bundleEndpoints`, `disableBundler`, `reFetchBundle`. | Passes `bundleEndpoints` / `reFetchBundle` to inner `<pie-player>`. | `strategy`, `loaderOptions.bundleHost`, `loaderConfig`; no direct `bundleEndpoints` / `reFetchBundle`. | Host migration requires mapping or aliases. |
| Styling prop name | `customClassname`. | `customClassname`. | `customClassName` / `custom-class-name`. | Naming mismatch for direct migration. |
| Error event detail | Mostly string payloads. | Structured `api-player-error` payloads for wrapper errors; inner `player-error` is captured. | Structured `player-error` objects. | Behavior is better typed but not drop-in compatible. |
| Session event detail | Child PIE detail bubbles after model/session setup suppression. | Saves current inner player session after `session-changed`. | Normalized `{ session, ... }`; metadata-only details filtered. | Cleaner behavior, but not identical detail semantics. |

## Scoring Parity Target

There are two distinct scoring targets:

1. **Open-source legacy parity** means expose a browser-local method equivalent
   to `provideScore()`. It should return per-model outcomes, include stimulus
   item support, pass `partialScoring`, preserve undefined/missing-result
   behavior where hosts rely on it, and use the controller call shape
   `(model, session, env)`.

2. **Legacy API-player parity** means expose or document a server-backed
   `score()` flow that persists or reads session events, honors manual scoring,
   rubric blocking, cached auto scores, server-side sanctioned versions, and API
   aggregation rules. This is not the same as calling element controllers in the
   browser.

For `<pie-item-player>` itself, the first missing piece is open-source legacy
parity: a functional `provideScore()`-style method on the custom element. A
rolled-up item score should be treated as a separate API decision because it
matches the legacy API player, not the open-source legacy `<pie-player>`.

## Recommended Implementation Order

1. Add `<pie-item-player>.provideScore()` with tests for single-element,
   multi-element, stimulus, missing-controller, missing-element, and
   `partialScoring` behavior.
2. Fix `scorePieItem()` or replace it with a host-scoped implementation that
   uses the real controller call shape and does not query the entire document.
3. Add a current-package migration table for legacy `bundleHost`,
   `bundleEndpoints`, `disableBundler`, `reFetchBundle`, `customClassname`, and
   stimulus props.
4. Decide whether current author mode must replace `<pie-author>` fully. If so,
   add `validateModels()`, `modelLoaded`, rubric helper parity, and complex
   rubric tests.
5. If API-player parity is in scope, design it as an API-backed adapter or a
   separate element/host integration surface. Do not silently make local
   browser `provideScore()` pretend to implement persisted API scoring.
