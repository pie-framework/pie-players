# 0005 — The player sets the idle-save delay through a host-neutral context

Status: Accepted, 2026-10-14

Owner: PIE Players maintainers

## Decision

A response editor that commits while the learner pauses, as well as on blur, takes the pause
length from its player, through the pattern [ADR 0003](./0003-elements-read-accessibility-settings-from-a-host-neutral-context.md)
sets for host settings.

- **Key and type.** `@pie-players/pie-context` exports `sessionCommitContext`, keyed
  `Symbol.for("pie.sessionCommit")`, and the value type `SessionCommitContextValue`.
- **Value.** `{ idleSaveDelayMs?: number }`, in milliseconds. `0` commits on blur only. An absent
  field means the element's own default.
- **Provider.** `<pie-item-player>` answers for every element it renders, from its
  `idleSaveDelayMs` property (`idle-save-delay-ms` attribute), and republishes a change. It
  provides `{}` when the host sets nothing, so the default lives in the element alone. The section
  player sets `runtime.player.idleSaveDelayMs` on each item player it embeds, as it does every
  `runtime.player` field it does not consume.
- **Subscription.** An element requests with `subscribe: true`.
- **No answer.** An unanswered request means the element's default, so a player that provides
  nothing, the legacy `pie-api-components` player included, needs no change.
- **Evolution.** Fields are added, never removed or redefined.

The item model carries no delay.

## Constraint

How often a response is saved is delivery policy, which the host sets once for every element on
the page. The same item, unchanged, is delivered by hosts with different save costs: on the legacy
player every save also scores the session. A setting in content would make each host's policy an
edit to every `extended-text-entry` and `explicit-constructed-response` model it delivers.

## Supporting reasons

The context needs no controller. With `backend.delivery` the player is hosted and runs no element
controller in the browser, so a setting that reached the element through `model()` would have to
be copied by the server-side controller too. A context request goes from the element to the
nearest provider in the DOM whatever produced the model.

## Rejected alternatives

- **A model property**, the `playerIdleSaveDelay` of
  [pie-elements-ng#442](https://github.com/pie-framework/pie-elements-ng/pull/442)'s first draft.
  Content would decide delivery policy, and authoring would persist a host's choice into the item.
- **A player-side model override**, after `autoplay-audio-enabled`, which writes
  `autoplayAudioEnabled` onto every model in the config. The setting still lands in the model, so
  every element's model schema gains a field that is never content.
- **`env`.** It reaches the element only through each controller's `model()` output, so every
  controller would copy it over, and a hosted player runs none.
- **A reflected attribute the element reads off its player**, after `base-heading-level`. The
  element would have to know the player's tag and attribute, which every other host would then
  imitate.

## Trade-off

A deliberate trade: one delay per player, at the cost of per-item tuning. An item that needs a
different delay is delivered in a player configured for it.

## Consequences

- An element that adopts idle save requests `sessionCommitContext` and keeps its own default;
  pie-elements-ng#442 drops `playerIdleSaveDelay` from the model when it does.
- An element release that does not read the context commits on blur only, whatever the player
  sets. The dictation spec in `packages/item-player/tests/item-player-dictation.spec.ts` asserts
  blur-only commit with the delay at `0`, which holds for every release.
- An idle commit is an ordinary `session-changed`, with no `sessionCommitReason`. With
  `backend.delivery.autosave` each one is saved after the autosave debounce, so a long answer costs
  a save per pause; the delay is the host's lever on that volume.
