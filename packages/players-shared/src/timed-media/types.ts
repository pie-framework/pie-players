/**
 * Timed-media section vocabulary.
 *
 * A **Cue** is a window on a media timeline that activates one or more of the
 * section's item refs. A **Media Time Source** is the port the section reaches
 * media through — never a library API, so a host can supply its own media
 * element without shipping a PIE element.
 *
 * See `docs/prds/timed-media-section-contract.md` for the ratified contract and
 * `docs/architecture/timed-media-section.md` for the layer-ownership record.
 */

import type { FormativeCorrectness } from "../formative/types.js";
import type { MediaFragmentRange } from "../types/index.js";

/**
 * What a cue does to the items it names.
 *
 * - `reveal`: the items become visible when the media reaches the cue.
 * - `gate`: as `reveal`, and playback is held until the release condition holds.
 * - `metadata`: state and events only — an author-visible timeline marker that
 *   reveals nothing and gates nothing.
 */
export type TimedMediaCueActivation = "reveal" | "gate" | "metadata";

/**
 * The condition over delivery state that releases a gate.
 *
 * Named from the shipped formative vocabulary rather than defined here, which is
 * the whole reason formative delivery sequenced first — see
 * `docs/adr/0001-formative-delivery-before-timed-media.md`. `"responded"` is the
 * response-only case, and it reads item completion rather than Try state so a
 * gate works in a section that does not deliver formatively at all.
 */
export type TimedMediaGateCondition =
	| "responded"
	| "correct"
	| "partial-or-better";

/**
 * What a gate does when the item cannot be auto-scored — `FormativeCorrectness`
 * of `"unknown"`, which is the honest state of an item holding a rubric element
 * rather than a defect to design around.
 *
 * Required on a gate whose condition is a correctness condition; see
 * `normalizeTimedMediaSectionData`. Not defaulted, because both answers are
 * defensible and the wrong silent one either traps a learner behind an item
 * nothing can score or waves through the checkpoint the author wrote.
 */
export type TimedMediaUnknownCorrectness = "release" | "hold";

export interface TimedMediaCuePolicy {
	activation: TimedMediaCueActivation;
	/** Required for `activation: "gate"`; ignored otherwise. */
	releaseOn?: TimedMediaGateCondition;
	/** Required when `releaseOn` names correctness; ignored otherwise. */
	onUnknownCorrectness?: TimedMediaUnknownCorrectness;
}

export interface TimedMediaCue {
	identifier: string;
	/**
	 * The window in which this cue is active, reusing the ratified range type. A
	 * point cue omits `endSeconds`.
	 *
	 * Carried beside the asset rather than inside `MediaAssetRef` because a range
	 * describes a *use* of an asset. Here that use is activation, not a slice to
	 * play, so it implies no seeking — the opposite of what the two shipped
	 * catalog consumers read the same shape as.
	 */
	range: MediaFragmentRange;
	/** Identifiers of this section's `assessmentItemRefs`. */
	itemRefs: string[];
	policy: TimedMediaCuePolicy;
}

export interface TimedMediaPlaybackPolicy {
	/** `false` clamps a forward seek to the furthest position already reached. */
	allowSeekAhead: boolean;
	/** `false` turns every `gate` cue into a `reveal`: nothing holds playback. */
	pauseOnRequiredCue: boolean;
	/** Whether `aggregateComplete` requires the media to have ended. */
	requireMediaCompletion: boolean;
}

/**
 * Authored scoring intent. Accepted, validated and persisted; PIE computes no
 * aggregate outcome from it yet and supplies no default, so a section that omits
 * it is not silently assigned one.
 */
export interface TimedMediaScoringPolicy {
	strategy:
		| "sum-child-outcomes"
		| "average-child-outcomes"
		| "weighted-child-outcomes"
		| "host-defined";
}

/**
 * The authored `timedMedia` payload, carried on `AssessmentSection`.
 *
 * No media payload: `stimulusRef` names the renderable that supplies the time
 * source, authored as a `class: "stimulus"` rubric block whose passage config
 * mounts the media element. The passage owns the asset and its accessibility
 * catalogs, because a passage is a Catalog Owner and a media blob is not.
 */
export interface TimedMediaSectionData {
	/**
	 * The rubric block identifier or passage id of the stimulus renderable.
	 * Required, and validated to resolve within this section: a section carrying
	 * cues with no resolvable stimulus is malformed, because the alternative is
	 * cues that silently never fire.
	 */
	stimulusRef: string;
	cues: TimedMediaCue[];
	playbackPolicy: TimedMediaPlaybackPolicy;
	scoringPolicy?: TimedMediaScoringPolicy;
}

/** A cue after validation, with every optional field decided. */
export interface ResolvedTimedMediaCue {
	identifier: string;
	range: MediaFragmentRange;
	/** Filtered to item refs this section actually holds. */
	itemRefs: string[];
	activation: TimedMediaCueActivation;
	/** Present only for a cue that holds playback. */
	releaseOn?: TimedMediaGateCondition;
	onUnknownCorrectness?: TimedMediaUnknownCorrectness;
	/**
	 * Whether this cue holds playback: `activation: "gate"` and a playback policy
	 * that has not switched gating off wholesale.
	 */
	holdsPlayback: boolean;
}

/** The authored data after validation. */
export interface ResolvedTimedMediaSectionData {
	stimulusRef: string;
	/** The renderable id the stimulus resolved to, which the layout renders. */
	stimulusRenderableId: string;
	cues: ResolvedTimedMediaCue[];
	playbackPolicy: TimedMediaPlaybackPolicy;
	scoringPolicy?: TimedMediaScoringPolicy;
}

/**
 * What a gated item's resolved formative policy leaves the learner.
 *
 * Read by validation, not by the reduction: a gate on correctness over an item
 * with a finite Try budget is a dead end, and so is one over an item that does not
 * deliver formatively at all — no Try means no correctness, ever.
 */
export type TimedMediaItemTryBudget = "unlimited" | "finite" | "not-formative";

export interface TimedMediaValidationError {
	/** Machine-readable, so a host can branch without parsing prose. */
	code:
		| "missing-stimulus-ref"
		| "unresolved-stimulus-ref"
		| "no-cues"
		| "duplicate-cue-identifier"
		| "invalid-cue-identifier"
		| "invalid-cue-range"
		| "invalid-cue-activation"
		| "unknown-item-ref"
		| "missing-item-refs"
		| "missing-release-condition"
		| "missing-unknown-correctness"
		| "gate-requires-unlimited-tries"
		| "invalid-playback-policy"
		| "invalid-scoring-policy";
	message: string;
	/** The cue the error is about, where it is about one. */
	cueIdentifier?: string;
}

export interface TimedMediaValidationResult {
	data: ResolvedTimedMediaSectionData | null;
	errors: TimedMediaValidationError[];
}

// ----------------------------------------------------------------------------
// Media Time Source port
// ----------------------------------------------------------------------------

/**
 * What the adapter can actually do, as opposed to what the section would like.
 *
 * Declared by the port rather than assumed by the section: a third-party embed
 * commonly exposes time and nothing else. Where a capability is missing the
 * matching policy degrades from enforced to advisory — cues still fire and state
 * is still recorded — and the degradation is reported as a recoverable framework
 * warning, because a seek lock that does not lock reads to an author as one that
 * does.
 */
export interface MediaTimeSourceCapabilities {
	canPause: boolean;
	canRestrictSeeking: boolean;
}

/** Structurally `TimeRanges`, so a native media element satisfies it as-is. */
export interface MediaTimeRanges {
	readonly length: number;
	start(index: number): number;
	end(index: number): number;
}

export type MediaTimeSourceNotification =
	| { type: "time"; currentTime: number }
	| { type: "seek"; currentTime: number }
	| { type: "play"; currentTime: number }
	| { type: "pause"; currentTime: number }
	| { type: "ended"; currentTime: number };

/**
 * The only way the section reaches media.
 *
 * Shaped after `HTMLMediaElement` deliberately: the browser's own surface is the
 * one every adapter author already knows, and a native `<video>` satisfies it
 * through the few lines in `createMediaElementTimeSource`. That is what keeps the
 * media-player dependency question reversible instead of load-bearing.
 *
 * Two departures from the element, both to make capability honest. Seeking is
 * `seekTo(seconds)` rather than a writable `currentTime`, because a writable
 * property gives a source that cannot seek no way to say so; and `capabilities`
 * has no element equivalent at all.
 */
export interface MediaTimeSource {
	readonly currentTime: number;
	/** `NaN` until metadata loads, as on the element. */
	readonly duration: number;
	readonly paused: boolean;
	readonly seekable: MediaTimeRanges | null;
	readonly capabilities: MediaTimeSourceCapabilities;
	play(): Promise<void> | void;
	pause(): void;
	seekTo(seconds: number): void;
	subscribe(
		listener: (notification: MediaTimeSourceNotification) => void,
	): () => void;
}

// ----------------------------------------------------------------------------
// Session state
// ----------------------------------------------------------------------------

/**
 * The persisted slice, carried on `SectionControllerSessionState.timedMedia`.
 *
 * One shape live and persisted, unlike formative's split between a per-item
 * reducer state and a slice: timed-media state is section-scoped, so there is
 * nothing to key.
 */
export interface TimedMediaSectionSessionSlice {
	version: 1;
	mediaCurrentTime: number;
	/**
	 * Furthest position reached, which is what `allowSeekAhead: false` clamps
	 * against. Persisted rather than derived because a reload would otherwise hand
	 * the learner the whole timeline back — an addition to the contract's session
	 * sketch, recorded in the PRD.
	 */
	maxPositionSeconds: number;
	mediaCompleted: boolean;
	visitedCueIdentifiers: string[];
	completedCueIdentifiers: string[];
	activeCueIdentifier?: string;
	aggregateComplete?: boolean;
}

// ----------------------------------------------------------------------------
// Reduction inputs and outputs
// ----------------------------------------------------------------------------

/**
 * Delivery state a gate condition reads, supplied by the caller so this module
 * stays pure and depends on neither the controller nor the formative module's
 * live state.
 */
export interface TimedMediaDeliveryState {
	/** Item completion by canonical id: the `"responded"` condition's signal. */
	respondedByItemId: Record<string, boolean>;
	/** Last Try correctness by canonical id; absent means no Try yet. */
	correctnessByItemId: Record<string, FormativeCorrectness | undefined>;
	/** Whether every item in the section reports completion. */
	itemsComplete: boolean;
}

export type TimedMediaInput =
	| { kind: "time"; currentTimeSeconds: number }
	| { kind: "seek"; currentTimeSeconds: number }
	| { kind: "ended"; currentTimeSeconds?: number }
	/** Delivery state changed under a held gate; re-evaluate releases. */
	| { kind: "delivery-changed" };

/**
 * What the caller must do to the port after a reduction. Advisory when the port
 * lacks the capability, which the caller reports rather than silently skipping.
 */
export interface TimedMediaEffects {
	/** A gate is holding and playback should stop. */
	pause: boolean;
	/** A forward seek exceeded policy and should be clamped here. */
	seekToSeconds?: number;
	/** Cue that activated in this reduction, for focus and announcement. */
	activatedCueIdentifier?: string;
	/** Cue whose gate released in this reduction, for announcement. */
	releasedCueIdentifier?: string;
}

export interface TimedMediaReduction {
	state: TimedMediaSectionSessionSlice;
	effects: TimedMediaEffects;
	/** `false` when the reduction produced the state it was given. */
	changed: boolean;
}

// ----------------------------------------------------------------------------
// Projection
// ----------------------------------------------------------------------------

export type TimedMediaEnforcement = "enforced" | "advisory";

export interface TimedMediaDegradation {
	policy: "pause-on-required-cue" | "restrict-seek-ahead";
	/** The capability the port does not have. */
	capability: keyof MediaTimeSourceCapabilities;
	message: string;
}

export interface TimedMediaGateView {
	cueIdentifier: string;
	itemRefs: string[];
	releaseOn: TimedMediaGateCondition;
	/** The gate is active and its condition does not hold. */
	holding: boolean;
	/** Whether holding actually stops playback, or is merely recorded. */
	enforcement: TimedMediaEnforcement;
}

/**
 * What layouts read off the composition model. Derived, never persisted — the
 * slice above is the state, this is the view of it.
 */
export interface TimedMediaSectionProjection {
	version: 1;
	stimulusRenderableId: string;
	cues: ResolvedTimedMediaCue[];
	playbackPolicy: TimedMediaPlaybackPolicy;
	/** Whether a media time source is attached; cues cannot fire without one. */
	mediaAttached: boolean;
	enforcement: {
		pause: TimedMediaEnforcement;
		seek: TimedMediaEnforcement;
	};
	degradations: TimedMediaDegradation[];
	/** Canonical ids of items whose cue has activated. Monotonic. */
	revealedItemIds: string[];
	activeCueIdentifier?: string;
	gate: TimedMediaGateView | null;
	visitedCueIdentifiers: string[];
	completedCueIdentifiers: string[];
	mediaCurrentTime: number;
	maxPositionSeconds: number;
	mediaCompleted: boolean;
	/**
	 * Every required cue complete, every item complete, and — where the policy
	 * requires it — the media ended. Deliberately three separate facts rather than
	 * one: a section can be item-complete with the video half watched.
	 */
	aggregateComplete: boolean;
}
