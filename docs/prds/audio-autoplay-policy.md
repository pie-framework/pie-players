# Audio Autoplay Policy

Status: Draft, 2026-10-12

The toolkit and item player sides have landed: `<pie-item-scope>` provides the decision, the item player writes it onto delivery models and announces `feature-decision-applied`, and `tools.policy` accepts `autoplayAudio`. The elements that carry `autoplayAudioEnabled` (categorize, drag-in-the-blank, hotspot, image-cloze-association, multiple-choice, EBSR and mc-populated-blank) honour `autoplayAudioHeld` from [pie-elements-ng#476](https://github.com/pie-framework/pie-elements-ng/pull/476), and authored `autoplay` is stripped on both sides — by the item player's feature-applier markup rule here, which is deliberately kept out of the security sanitizer's forbid-list, and by the elements repo's markup pass.

The PRD stays `Draft` pending acceptance, including the [Open Questions](#open-questions) below; the implementation followed it rather than the other way round.

Owner: PIE Players maintainers

Related architecture:

- [ADR 0004](../adr/0004-screen-reader-use-is-a-profile-support-that-withholds-read-aloud.md):
  the feature id `autoplayAudio`, the `support-conflict` block for screen-reader students, and the
  precondition that a block reaches only element versions that keep the audio playable.
- [ADR 0003](../adr/0003-elements-read-accessibility-settings-from-a-host-neutral-context.md): the
  `context-request` protocol and why a host-neutral key lives in `@pie-players/pie-context`.
- [Audio Accommodations](./audio-accommodations.md): the audio transcript. This PRD answers its open
  question on how an autoplay decision reaches an element.
- [PNP Configuration Guide](../../packages/assessment-toolkit/docs/PNP_CONFIGURATION.md#precedence):
  the eight-level precedence.
- [Support ids](../../packages/assessment-toolkit/docs/TOOL_REGISTRY.md#support-ids).

## Problem

Autoplay of an item's audio is the authored per-model field `autoplayAudioEnabled`. The item
player's `autoplay-audio-enabled` attribute overwrites it on every model of one player instance, and
nothing else sets it. Assessment programs decide autoplay from more than the item: a district or a
test administration turns it on or off, a student's profile prohibits self-starting audio, and
adaptive delivery decides per item whether audio leads, as for early-literacy items whose audio is
integral to the item and reading items whose construct excludes it. A host can state none of these
except by rewriting models or setting the attribute per player instance. ADR 0004 makes autoplay
the feature `autoplayAudio` and blocks it for screen-reader students; which other rules set it, and
how a decision reaches an element, is this PRD.

The attribute's route cannot carry a decision as it stands:

- It applies in author mode, so a delivery setting can reach saved content.
- A change after the first load is ignored: `loadConfig`'s no-op guard compares a signature that
  leaves the override out.
- A backend model refresh (`mergeModelsForConfig`, `applyRefreshedBackendConfigs`) rebuilds models
  without it.
- EBSR reads autoplay from `partA` and `partB`, which the override never writes.
- It reaches every element version, including those whose audio then has no working start: the
  shared prompt renderer overwrites the authored audio's id, so a play link plays nothing, and an
  item requiring audio completion never completes.

## Goals

- `autoplayAudio` resolves through the host gates and the eight-level precedence from inputs hosts
  already set. No policy field is added.
- One decision per item scope, applied identically in the section player and in a host's item
  player wrapped in `<pie-item-scope>`.
- A block reaches only element versions that keep the audio playable without autoplay. A grant
  reaches every version.
- The decision applies before the item first renders, on every path that builds delivery models,
  and never in author mode.
- A host without the toolkit keeps the attribute's current behavior.
- pie-elements-ng releases that meet ADR 0004's precondition for every element with an authored
  autoplay setting.

## Non-Goals

- Removing audio from an item. Audio a construct excludes is content, set by the item.
- Overriding the browser's autoplay policy. A grant asks the element to autoplay; a browser that
  blocks unprompted playback still blocks it, and the element's existing prompt to enable audio
  stays.
- Reporting whether an element version honored a decision. The item player reports the decision it
  applied; effective-setting reporting is a separate contract.
- A teacher- or proctor-facing control. Hosts set the policy inputs.
- Element versions published before the precondition releases. They keep authored autoplay under a
  block; the remedy is the pie-elements-ng release that meets it.

## Package And Export Ownership

- Owning package: `@pie-players/pie-context`, for the context key and value type. The toolkit
  decides, the item player applies, and neither imports the other.
- Public export path: `@pie-players/pie-context` exports `itemFeatureDecisionsContext` and
  `ItemFeatureDecisions`.
- Provider: `<pie-item-scope>` in `@pie-players/pie-assessment-toolkit`, from
  `ToolkitCoordinator.decideFeaturePolicy("autoplayAudio", itemScope)`.
- Consumer: `<pie-item-player>` in `@pie-players/pie-item-player`, which gains a dependency on
  `@pie-players/pie-context` (no dependencies of its own).
- Element side: the model field `autoplayAudioHeld`, read by pie-elements-ng delivery elements and
  documented in the item player README beside `autoplayAudioEnabled`.
- Runtime environment: browser, custom element.

## Contract Shape

```ts
// Documentation sketch only.

// @pie-players/pie-context
export const itemFeatureDecisionsContext = createContext<ItemFeatureDecisions>(
	Symbol.for("pie.itemFeatureDecisions"),
);

export interface ItemFeatureDecisions {
	/** Keyed by feature id. An id absent here is one no rule names. */
	readonly features: Readonly<Record<string, ItemFeatureDecision>>;
}

export interface ItemFeatureDecision {
	readonly granted: boolean;
	/** The deciding rule, as `FeaturePolicyDecision.rule` names it. */
	readonly rule: string;
}

// @pie-players/pie-item-player: `feature-decision-applied` event detail
export interface FeatureDecisionAppliedDetail {
	featureId: string;
	granted: boolean;
	rule: string;
	/** What the decision displaced on at least one model, if anything. */
	overrode?: "attribute" | "authored";
}
```

### Policy inputs

Every row is an existing input; the first that matches decides.

| Precedence | Input | Rule | Effect |
| --- | --- | --- | --- |
| 0 | `tools.policy.blocked` lists `autoplayAudio` | `host-blocked` | Held |
| 0 | `tools.policy.allowed` is non-empty and omits `autoplayAudio` | `host-allowlist` | Held |
| 1 | `districtPolicy.blockedTools` | `district-block` | Held |
| 2 | `testAdministration.toolOverrides.autoplayAudio === false` | `test-admin-override` | Held |
| 3 | item `restrictedTools` | `item-restriction` | Held |
| 4 | `personalNeedsProfile.prohibitedSupports` | `pnp-prohibited` | Held |
| 4 | `screenReader` resolves enabled (ADR 0004) | `support-conflict` | Held |
| 5 | `toolOverrides.autoplayAudio === true` | `test-admin-override` | Enabled |
| 6 | item `requiredTools` | `item-requirement` | Enabled |
| 7 | `districtPolicy.requiredTools` | `district-requirement` | Enabled |
| 8 | `personalNeedsProfile.supports` | `pnp-support` | Enabled |
| — | no rule (`rule: "none"`) | — | The attribute, else the authored value |

The host gates take the precedent every feature decision follows, the signed alternate and the
transcript included: an allowlist names every capability a host admits. Per-item decisions, such as
an adaptive engine choosing whether an item's audio leads, are item `requiredTools` or
`restrictedTools` on the item's `<pie-item-scope settings>`. Feature decisions ignore
`pnpEnforcement`, as they do for every feature.

### Provider

`<pie-item-scope>` answers `context-request` for `itemFeatureDecisionsContext` from its item player
and republishes on every policy change and every change to its `settings`. It publishes the ids the
item player applies, `autoplayAudio` alone today, and leaves out an id whose decision is
`rule: "none"`. A scope with no toolkit answers `{ features: {} }`.

### Item player

The item player requests the context with `subscribe: true` before it prepares the config. Each
feature it applies is one applier in a registry: the applier writes the feature's setting and
decision onto the models and declares the markup switches the model setting replaces, and the
registry owns when both happen. The autoplay applier derives one effective value per load:

- **Held.** Writes `autoplayAudioHeld: true` on every model. `autoplayAudioEnabled` keeps the
  attribute's or the authored value. An element version that predates the field never reads it and
  autoplays as authored, so the hold reaches only versions that meet ADR 0004's precondition.
- **Enabled.** Writes `autoplayAudioEnabled: true` on every model and no `autoplayAudioHeld`.
- **No decision.** The attribute and the authored value apply as today.

A held or enabled decision also lands on every direct child object of a model that declares
`autoplayAudioEnabled`, so EBSR's parts receive it in every delivered version. The attribute keeps
writing top-level models only, as today: a host that sets it to `true` has never reached EBSR's
parts, and parts authored with autoplay off stay off.

The write applies in `view` mode, whatever the `env` mode, and never in `author` mode. It applies
on the initial load, on a change to the attribute or the decision, and after a backend model
refresh. The no-op guard in `loadConfig` includes the effective value, so a change re-enters the
load: sessions commit (`commitPendingSessions`) and the item remounts, since elements read autoplay
at mount.

In `view` mode the item player also removes `autoplay` attributes from the item and passage markup,
whatever the decision and under `trust-markup` or a host `sanitizeMarkup` too, so authored markup
cannot start audio the model setting does not. The removal is the autoplay applier's markup rule,
kept out of the security sanitizer's forbid-list: it is a product rule, and a trusted or host
sanitizer skips that list.

Before the elements render, the item player dispatches `feature-decision-applied` once per feature
with a held or enabled decision. `overrode` names the attribute when it was set to the opposite value, else
`authored` when some model's authored value was the opposite, else is absent. `<pie-item-scope>`
relays the event to its toolkit. The toolkit raises one `tool-policy.supportConflict` for each
`support-conflict` hold that withdrew something, as ADR 0004 specifies: at decision time when the
conflict displaced a granting rule, which it names, else from the event when `overrode` is set.
Other blocks raise no diagnostic: a person recorded them.

### Elements

Each pie-elements-ng element with an authored `autoplayAudioEnabled` setting (categorize,
drag-in-the-blank, ebsr, hotspot, image-cloze-association, mc-populated-blank, multiple-choice)
starts reading `autoplayAudioHeld` only in a release that meets all of these:

1. **Playable.** With autoplay off or held, every rendered prompt audio has a keyboard-operable play
   control. The shared prompt renderer points authored play links at the id it generates for the
   audio, so they play it, and renders native controls where the item has no play control of its
   own.
2. **No authored autoplay.** The model sanitizer strips the `autoplay` attribute from authored
   `<audio>`, so the model field is the only start.
3. **Completion reachable.** `completeAudioEnabled` completes once the audio has played, and does
   not wait on audio that failed to load, that the model declares but does not supply, or that a
   restored session already records as played.
4. **Held reads as off.** `autoplayAudioHeld: true` outranks `autoplayAudioEnabled: true`. EBSR
   reads it from the top-level model and its parts.

## Compatibility

- **PIE element runtime contract.** Adds the model field `autoplayAudioHeld`, which element
  versions that predate it never read.
- **`pie-item-player` properties and events.** Adds the `feature-decision-applied` event and a
  context request. The attribute keeps its name, values and top-level reach; it stops applying in
  author mode, which no recorded host uses.
- Versioned tag names, contract attributes, section and assessment session state, and persisted
  session data are untouched.
- A host on the toolkit that sets no `autoplayAudio` input, and no profile listing `screenReader`,
  sees no change: every decision is `rule: "none"`. A non-empty `tools.policy.allowed` is the
  exception: like every capability it omits, autoplay resolves held under `host-allowlist` for every
  student unless the allowlist lists `autoplayAudio`. No recorded host sets an allowlist.

## Data Ownership And Host Responsibilities

PIE owns:

- The `autoplayAudio` decision per item scope and its precedence.
- Applying the decision to delivery models, and keeping it off authoring models.
- Element behavior under a hold: a play control, no authored autoplay, reachable completion.
- The `tool-policy.supportConflict` diagnostic for a withdrawn autoplay.

Hosts own:

- The policy inputs: district policy, test-administration overrides, item settings, the profile.
- Binding the assessment before items mount, so the first answer already carries the decision.
- Reporting the effective setting to staff, and every persistence, identity and product policy.

## Serialization And Versioning

No persisted or wire-facing data. `autoplayAudioHeld` is written onto delivery models at load and
never saved: author mode does not receive it. The context value follows ADR 0003's evolution rule:
the item player ignores ids it does not apply, and fields are added, never redefined.

## Accessibility

A hold serves WCAG 2.2 SC 1.4.2 Audio Control by not starting audio, and serves a screen-reader
student by not talking over the screen reader (ADR 0004). The element requirements keep the audio
reachable by keyboard, so a hold never costs a student the prompt or the item. A grant starts audio
on element versions that may offer no pause control; element requirement 1 gives conforming
versions one, and the attribute set to `true` already does the same to older versions today.

## Standards Or Adapter Impact

None. AfA PNP 3.0 has no autoplay term, so `autoplayAudio` is a PIE id; the nearest AfA term,
`audioControl`, is not mapped. No adapter consumes the decision.

## Test Plan

- Toolkit: a decision per row of the policy-inputs table, item rows scoped per item; the scope
  republishes on a policy change and a `settings` change; `rule: "none"` stays out of the value.
- Item player: held writes `autoplayAudioHeld` and keeps `autoplayAudioEnabled`; enabled writes
  `true`; no decision leaves attribute and authored values; author mode receives neither; an
  attribute change after load re-applies; a backend refresh keeps the effective value; EBSR parts
  receive a decision's fields and never the attribute's; a change commits sessions before the
  remount; `feature-decision-applied`
  carries `overrode` for the attribute and for authored values.
- Section player, Playwright: a profile listing `screenReader` holds an item authored with autoplay;
  the prompt plays from the keyboard and the item completes under `completeAudioEnabled`.
- pie-elements-ng: per element, the four element requirements, including a resumed session that
  already recorded the audio as played and an item declaring audio it does not supply.

```sh
bun run typecheck
bun run test
```

Run the [high-value checks](../../AGENTS.md#high-value-checks) for the toolkit and item player
changes. Playwright-backed tests run outside the sandbox; see
[Playwright and sandboxed execution](../../AGENTS.md#playwright-and-sandboxed-execution).

## Rollout And Release Notes

- Changeset required: yes, for `@pie-players/pie-context`, `@pie-players/pie-assessment-toolkit`
  and `@pie-players/pie-item-player`; pie-elements-ng releases for the seven elements and the shared
  prompt renderer and sanitizer.
- Migration notes: a host with a non-empty `tools.policy.allowed` adds `autoplayAudio` to it to
  keep authored autoplay. A host that wants autoplay set by policy sets the inputs above; the
  attribute stays for hosts without the toolkit.
- Documentation updates: the item player README (attribute, event, `autoplayAudioHeld`), the PNP
  Configuration Guide (an `autoplayAudio` example), and the Audio Accommodations open question,
  which this PRD resolves once accepted.
- Release risk: an element release that reads `autoplayAudioHeld` before meeting the element
  requirements reintroduces the lockout, so the reader and the requirements ship together.

## Open Questions

- **Does the item player wait for the scope's first answer?** An item player under a scope whose
  toolkit has not yet bound its assessment renders the authored value, then remounts when the
  decision arrives, which can start audio briefly. Recommended: the scope answers synchronously once
  its toolkit has answered it, which the section player satisfies, and hosts composing their own
  item player bind the assessment before mounting items. The alternative is a `ready` field on the
  value that the item player waits on, which needs a timeout for a scope that never finds a
  toolkit.
- **Does element audio join the read-aloud handoff?** When a student starts read-aloud while an
  element's audio plays, neither pauses. The toolkit's audio handoff covers the signed alternate and
  timed media only.
- **Do elements confirm a hold?** The item player reports the hold it wrote, not whether the
  element version read it, so a hold on a version predating the field goes unreported. A
  confirmation belongs with effective-setting reporting.
