# Item Feature Decisions

Status: Implemented, 2026-10-16

This note is the design record for how a toolkit policy decision on an item feature reaches the
elements that carry it out. It is for contributors adding an item feature, or changing the item
player, `<pie-item-scope>`, the toolkit's feature policy or an element's model sanitizer. The
[audio autoplay policy](../prds/audio-autoplay-policy.md) owns the contract for `autoplayAudio`,
the first feature on this path; where this note and the PRD differ, the PRD governs.
[ADR 0004](../adr/0004-screen-reader-use-is-a-profile-support-that-withholds-read-aloud.md) records
why screen-reader use holds autoplay, and
[ADR 0003](../adr/0003-elements-read-accessibility-settings-from-a-host-neutral-context.md) why a
host-neutral context key lives in `@pie-players/pie-context`.

## Context

Most tool policy outcomes show or hide a tool the toolkit renders. An item feature is one an element
carries out from its own model: prompt audio that starts on mount is the first. The toolkit decides
it per item scope, from the same inputs and precedence as every tool. The element reads only its
model. The item player sits between them and owns the translation.

The path is generic in everything except the translation. The context value, the applied event, the
load guard, the diagnostics and the markup pass are shared; one applier per feature holds the model
fields and the markup it replaces.

## Decision Flow

![Item feature decisions as implemented: the host's policy inputs reach the assessment toolkit, whose PolicyEngine.decideFeature applies the host gates and the eight-level precedence per feature id and item scope, a screen reader holding autoplayAudio as a support conflict; pie-item-scope publishes the decisions for ITEM_PLAYER_FEATURE_IDS through itemFeatureDecisionsContext; pie-item-player combines them with its own autoplay-audio-enabled attribute through ITEM_FEATURE_APPLIERS and writes autoplayAudioHeld or autoplayAudioEnabled onto the models, removing authored autoplay; the delivery elements read autoplayAudioOn(model). The item player reports feature-decision-applied back through the scope to reportFeatureDecisionApplied, which raises tool-policy.supportConflict for a support-conflict hold that overrode a setting](../img/item-feature-decisions-flow.excalidraw.svg)

1. **Decide.** `PolicyEngine.decideFeature(featureId, scope)` applies the host gates, then the
   eight-level [precedence](../../packages/assessment-toolkit/docs/PNP_CONFIGURATION.md#precedence),
   then `TOOLKIT_SUPPORT_CONFLICTS`: a profile with `screenReader` enabled withholds `autoplayAudio`
   as `support-conflict`. Feature decisions ignore `pnpEnforcement`.
2. **Publish.** `<pie-item-scope>` asks for each id in `ITEM_PLAYER_FEATURE_IDS` with the item's
   scope and answers `itemFeatureDecisionsContext` for its item player. It leaves out an id whose
   rule is `none`, and republishes on a policy change only when a decision changed. A scope with no
   toolkit answers `{ features: {} }`.
3. **Apply.** The item player subscribes to the context, combines each decision with its own setting
   for the feature, and writes the result onto the delivery models before the elements mount.
4. **Carry out.** The element reads its model field. For autoplay, `autoplayAudioOn(model)` in
   `@pie-element/shared-utils` returns false under `autoplayAudioHeld: true`, whatever
   `autoplayAudioEnabled` says.

The decision lands on the model because the model is the element's whole input: a field written
there reaches every element version that reads it, in every host, with no per-element context
subscription. An element version that predates the field never reads it, so a hold reaches only the
versions that meet ADR 0004's precondition.

## Contract

| Surface | Package | Shape |
| --- | --- | --- |
| `itemFeatureDecisionsContext`, key `Symbol.for("pie.itemFeatureDecisions")` | `@pie-players/pie-context` | `{ features: Record<featureId, { granted, rule }> }`; an absent id is one no rule names |
| `feature-decision-applied` (`FEATURE_DECISION_APPLIED_EVENT`) | `@pie-players/pie-context` | `{ featureId, granted, rule, overrode? }`, once per feature with a decision written |
| `ITEM_PLAYER_FEATURE_IDS` | `@pie-players/pie-assessment-toolkit` | the ids a scope publishes, `["autoplayAudio"]` |
| Model fields | element runtime contract | owned by each feature; `autoplayAudioHeld` and `autoplayAudioEnabled` for autoplay |

The item player dispatches `feature-decision-applied` before the elements render. `overrode` names
what the decision displaced on at least one model: `attribute` when the player's own setting was the
opposite value, else `authored` when an authored value was, else it is absent. Item and passage
details merge to one per feature, `attribute` outranking `authored`. A setting with no decision
writes the models and reports nothing.

## Applier Registry

![The applier registry: the autoplay-audio-enabled attribute, the itemFeatureDecisionsContext subscription and the resolved mode form ItemFeatureInputs, whose itemFeaturesSignature re-enters the load on a change, committing sessions and remounting the item. applyItemFeatures runs on load, on a setting or decision change and after a backend model refresh, in view mode only: first every applier's markup rules through applyMarkupRules, removal only, then each applier with a setting or a decision through apply(config, setting, decision), returning the config and what it overrode. autoplayAudioApplier is the one registered applier; the next feature is one more applier and its id in ITEM_PLAYER_FEATURE_IDS. The config goes on to the players-shared sanitizer and the elements; the applied details merge to one feature-decision-applied event per feature before the elements render](../img/item-feature-applier-registry.excalidraw.svg)

`ItemFeatureApplier` in
[`item-features.ts`](../../packages/item-player/src/utils/item-features.ts) is the unit of a
feature:

```ts
interface ItemFeatureApplier<S = unknown> {
	readonly featureId: string;
	apply(
		config: ConfigWithModels,
		setting: S | undefined,
		decision: ItemFeatureDecision | null,
	): { config: ConfigWithModels; overrode?: "attribute" | "authored" };
	readonly markupRules?: readonly MarkupRule[];
}
```

The applier owns what is written; `applyItemFeatures` owns when. It runs in `prepareConfigEntity` on
every load and in the backend refresh path, so a refreshed model keeps the decision. It calls an
applier only when the feature has a setting or a decision, and `apply` is idempotent on models it
already wrote. Author mode receives neither model writes nor markup changes, so authoring never
persists a delivery decision.

`ItemFeatureInputs` carries the resolved mode, each feature's setting on the player keyed by
feature id (`autoplayAudio` from the `autoplay-audio-enabled` attribute) and the decisions.
`itemFeaturesSignature` is part of the load's no-op guard: a changed setting or verdict commits
pending sessions and remounts the item, because elements read these fields at mount. A changed rule
with the same verdict leaves the signature as it was.

`autoplayAudioApplier` writes `autoplayAudioHeld: true` for a hold and `autoplayAudioEnabled: true`
for a grant, on every model and on every direct child that declares `autoplayAudioEnabled`, which
reaches EBSR's parts. The attribute keeps writing top-level models only.

## Markup Rules and Sanitizer Boundaries

![Markup boundaries: in pie-players the item player runs item and passage config.markup through every applier's feature markup rules in view mode, whatever the host sets, then through one of three choices the host makes, the default sanitizer with SANITIZER_FORBIDDEN_TAGS and SANITIZER_FORBIDDEN_ATTRS, the host's own sanitizeMarkup, or trust-markup's markup as given, into the item DOM. In pie-elements-ng the delivery elements run model HTML fields through sanitizeModelHtml with MODEL_HTML_FORBIDDEN_TAGS, MODEL_HTML_FORBIDDEN_ATTRS and AUTOPLAY_AUDIO_MARKUP_ATTRS into the element DOM, where autoplayAudioOn(model) is the only start for prompt audio. The two repositories each hold a copy of the same rule data. Security covers what untrusted content may never run; feature rules cover the switches a model setting replaces](../img/item-markup-boundaries.excalidraw.svg)

Two removals run over item content, with different owners:

- **Security.** The players-shared sanitizer removes what untrusted content may never run. The host
  chooses the sanitizer: the default with `SANITIZER_FORBIDDEN_TAGS` and `SANITIZER_FORBIDDEN_ATTRS`,
  its own `sanitizeMarkup`, or none under `trust-markup`.
- **Feature rules.** An applier's `markupRules` name the switches in authored markup that its model
  setting replaces. `applyMarkupRules` removes them from item and passage markup in view mode,
  before the host's sanitizer choice, so they hold under `trust-markup` and a host sanitizer too.
  Without that, an authored `<audio autoplay>` would start audio a hold is meant to stop.

`MarkupRule` is a union discriminated on `kind`, and only `{ kind: "attribute", name }` ships.
Rules are removal-only and unconditional: a rule never adds to markup, so no rule can undo what the
sanitizer removed, and a rule does not depend on the decision, so the model setting is the
feature's only switch. Markup that mentions no rule's name is returned as given without a parse,
which keeps trusted markup byte-identical.

pie-elements-ng applies the same rule to model HTML, a separate surface the item player never sees.
`sanitizeModelHtml` forbids `AUTOPLAY_AUDIO_MARKUP_ATTRS` next to its security lists
`MODEL_HTML_FORBIDDEN_TAGS` and `MODEL_HTML_FORBIDDEN_ATTRS`, so the security lists stay security
only there as well.

## Diagnostics

`<pie-item-scope>` relays `feature-decision-applied` to
`ToolkitCoordinator.reportFeatureDecisionApplied` with the item's scope. The toolkit raises one
`tool-policy.supportConflict` for each `support-conflict` hold that withdrew something, as ADR 0004
specifies: at decision time when the conflict displaced a granting rule, which the diagnostic names,
else from the event when `overrode` is `attribute` or `authored`. Other holds raise no diagnostic,
because a person recorded them.

## Adding an Item Feature

1. Give the feature an id that `decideFeature` resolves, and a `TOOLKIT_SUPPORT_CONFLICTS` entry if a
   profile support withholds it.
2. Add the id to `ITEM_PLAYER_FEATURE_IDS` in
   [`item-feature-decisions.ts`](../../packages/assessment-toolkit/src/runtime/item-feature-decisions.ts).
3. Write an applier for its model fields, with `markupRules` for any authored switch the fields
   replace, and add it to `ITEM_FEATURE_APPLIERS`. A player setting for the feature is one more
   entry in `ItemFeatureInputs.settings`.
4. Make the element read the model field, and forbid the same switches in its model HTML sanitizer
   when model HTML can carry them.

The context, the event, the load guard, the scope's publishing and the diagnostics need no change.

## Trade-offs

- **Rule data in two repositories.** The applier's `markupRules` and pie-elements-ng's
  `AUTOPLAY_AUDIO_MARKUP_ATTRS` each name `autoplay`. A deliberate trade: no cross-repository
  dependency, at the cost of the two lists being able to diverge.
- **Removal-only rules.** A rule cannot rewrite markup. A new kind is a new union member and a new
  case in `applyMarkupRules`. A kind that adds to markup needs its own security review, because
  the pass runs where `trust-markup` skips the sanitizer.
- **Remount on change.** A changed decision commits sessions and remounts the item, because elements
  read autoplay at mount. A feature that elements read live could skip the remount, and would need
  its own signature.
- **Model reach.** A decision reaches only element versions that read its field, so each feature
  inherits ADR 0004's precondition for its own elements.

## Compatibility

The 2026-10-16 change from the first cut of this path replaces the event's `effect: "held" |
"enabled"` with `granted`, widens `featureId` to any feature id, and moves the `autoplay` removal
from the security forbid-list to the autoplay applier. The print player applies no item features
and keeps `autoplay` in its markup, as in the last published release. No recorded host
listens for the event or sets `trust-markup` or `sanitizeMarkup`
([consumer API dependencies](../integrations/consumer-api-dependencies.md)).
