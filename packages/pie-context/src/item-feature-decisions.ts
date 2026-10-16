import { createContext } from "./types.js";

/** A policy verdict on one feature for one item. */
export interface ItemFeatureDecision {
	readonly granted: boolean;
	/** The deciding rule, as the toolkit's `FeaturePolicyDecision.rule` names it. */
	readonly rule: string;
}

/**
 * The toolkit's feature decisions for one item, which its item player applies
 * to the item's delivery models.
 *
 * `<pie-item-scope>` provides it; the item player requests it with
 * `subscribe: true`. An unanswered request, or an id absent from `features`,
 * means no rule names the feature, and the item keeps its own setting. The item
 * player ignores ids it does not apply.
 *
 * Fields are added, never removed or redefined, because pinned player versions
 * keep reading the shape they shipped with.
 */
export interface ItemFeatureDecisions {
	/** Keyed by feature id. An id absent here is one no rule names. */
	readonly features: Readonly<Record<string, ItemFeatureDecision>>;
}

/**
 * `Symbol.for`, so a player's bundled copy of this package requests the same
 * key the toolkit provides.
 */
export const itemFeatureDecisionsContext = createContext<ItemFeatureDecisions>(
	Symbol.for("pie.itemFeatureDecisions"),
);

/**
 * The item player's `feature-decision-applied` event, dispatched once per
 * feature before the item's elements render with its decision written to their
 * models. `<pie-item-scope>` relays it to its toolkit.
 */
export const FEATURE_DECISION_APPLIED_EVENT = "feature-decision-applied";

export interface FeatureDecisionAppliedDetail {
	/** The feature id, as `ItemFeatureDecisions.features` keys it. */
	featureId: string;
	/** The decision's verdict, from the context value. */
	granted: boolean;
	/** The deciding rule, from the context value. */
	rule: string;
	/**
	 * What the decision displaced on at least one model, if anything: the item
	 * player's own setting for the feature, such as an attribute, or the item's
	 * authored setting.
	 */
	overrode?: "attribute" | "authored";
}
