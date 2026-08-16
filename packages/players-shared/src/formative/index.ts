/**
 * Formative delivery: Try state, feedback reveal, and section mastery.
 *
 * Pure and Node-safe by design — no DOM, no timers, no element registry — so
 * the contract is testable without a browser and an adapter can import it
 * without pulling in a player. Everything that touches the DOM stays in
 * `@pie-players/pie-section-player`.
 *
 * Contract: `docs/prds/formative-delivery-contract.md`.
 */
export type {
	FormativeAction,
	FormativeCorrectness,
	FormativeDeliveryPolicy,
	FormativeEnvOverride,
	FormativeFeedbackReveal,
	FormativeItemPolicy,
	FormativeItemState,
	FormativeItemView,
	FormativeMasteryRollup,
	FormativeRevealTiming,
	FormativeScoredOutcome,
	FormativeSectionProjection,
	FormativeSectionSlice,
	FormativeTryLimit,
	FormativeTryOutcome,
	ResolvedFormativePolicy,
} from "./types.js";

export {
	FORMATIVE_POLICY_DEFAULTS,
	isFormativeSectionEnabled,
	resolveFormativePolicies,
	resolveFormativePolicy,
} from "./policy.js";

export { aggregateFormativeOutcome } from "./outcome.js";

export {
	FORMATIVE_ITEM_STATE_VERSION,
	createFormativeItemState,
	hideFormativeItem,
	recordFormativeTry,
	resolveFormativeItemView,
	retryFormativeItem,
	revealFormativeItem,
} from "./state.js";

export { FORMATIVE_MASTERY_VERSION, rollupFormativeMastery } from "./mastery.js";

export {
	FORMATIVE_SLICE_VERSION,
	normalizeFormativeSectionSlice,
	toFormativeSectionSlice,
} from "./session.js";
