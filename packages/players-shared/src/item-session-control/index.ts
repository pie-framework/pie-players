/**
 * Item session control: Try state, feedback reveal, and section mastery.
 *
 * Pure and Node-safe by design — no DOM, no timers, no element registry — so
 * the contract is testable without a browser and an adapter can import it
 * without pulling in a player. Everything that touches the DOM stays in
 * `@pie-players/pie-section-player`.
 *
 * Contract: `docs/prds/item-session-control-contract.md`.
 */
export type {
	TryAction,
	TryCorrectness,
	ItemSessionControlPolicy,
	FeedbackEnvOverride,
	FeedbackReveal,
	ItemTryState,
	ItemTryView,
	MasteryRollup,
	FeedbackRevealTiming,
	ScoredElementOutcome,
	TrySectionProjection,
	TrySectionSlice,
	TryLimit,
	TryOutcome,
	ResolvedItemSessionControlPolicy,
} from "./types.js";

export {
	ITEM_SESSION_CONTROL_DEFAULTS,
	isItemSessionControlEnabledInSection,
	resolveItemSessionControls,
	resolveItemSessionControl,
} from "./policy.js";

export { aggregateTryOutcome } from "./outcome.js";

export {
	ITEM_TRY_STATE_VERSION,
	createItemTryState,
	hideItemFeedback,
	recordTry,
	resolveItemTryView,
	retryItem,
	revealItemFeedback,
} from "./state.js";

export { MASTERY_ROLLUP_VERSION, rollupMastery } from "./mastery.js";

export {
	TRY_SLICE_VERSION,
	normalizeTrySectionSlice,
	toTrySectionSlice,
} from "./session.js";
