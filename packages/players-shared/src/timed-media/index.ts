/**
 * Timed-media sections: cue policy, playback policy, and the Media Time Source
 * port.
 *
 * Pure apart from one adapter factory that is inert until called, so the contract
 * is testable without a browser and an adapter can import it without pulling in a
 * player. Live cue state belongs to `SectionController` in
 * `@pie-players/pie-section-player`, which is where the equivalent formative state
 * lives — one rollup over one item set, in one package.
 *
 * Contract: `docs/prds/timed-media-section-contract.md`.
 */

export type {
	MediaTimeRanges,
	MediaTimeSource,
	MediaTimeSourceCapabilities,
	MediaTimeSourceNotification,
	ResolvedTimedMediaCue,
	ResolvedTimedMediaSectionData,
	TimedMediaCue,
	TimedMediaCueActivation,
	TimedMediaCuePolicy,
	TimedMediaDegradation,
	TimedMediaDeliveryState,
	TimedMediaEffects,
	TimedMediaEnforcement,
	TimedMediaGateCondition,
	TimedMediaGateView,
	TimedMediaInput,
	TimedMediaItemTryBudget,
	TimedMediaPlaybackPolicy,
	TimedMediaReduction,
	TimedMediaScoringPolicy,
	TimedMediaSectionData,
	TimedMediaSectionProjection,
	TimedMediaSectionSessionSlice,
	TimedMediaUnknownCorrectness,
	TimedMediaValidationError,
	TimedMediaValidationResult,
} from "./types.js";

export {
	TIMED_MEDIA_PLAYBACK_POLICY_DEFAULTS,
	normalizeTimedMediaSectionData,
} from "./policy.js";

export {
	TIMED_MEDIA_SLICE_VERSION,
	createTimedMediaState,
	reduceTimedMediaState,
	resolveTimedMediaEnforcement,
	resolveTimedMediaProjection,
	timedMediaProjectionSignature,
} from "./state.js";

export {
	normalizeTimedMediaSectionSlice,
	toTimedMediaSectionSlice,
} from "./session.js";

export {
	NATIVE_MEDIA_CAPABILITIES,
	createMediaElementTimeSource,
	findMediaElement,
	type MediaElementTimeSourceOptions,
} from "./media-element-source.js";
