/**
 * The cue reduction: media position plus delivery state in, cue state and the
 * effects the port must be driven with out.
 *
 * Pure and Node-safe, which is what makes cue policy testable without a browser
 * and what keeps it out of every layout that hosts timed media. The caller owns
 * the port and applies the effects; nothing here touches media.
 */

import type { FormativeCorrectness } from "../formative/types.js";
import type {
	MediaTimeSourceCapabilities,
	ResolvedTimedMediaCue,
	ResolvedTimedMediaSectionData,
	TimedMediaDegradation,
	TimedMediaDeliveryState,
	TimedMediaEffects,
	TimedMediaGateView,
	TimedMediaInput,
	TimedMediaReduction,
	TimedMediaSectionProjection,
	TimedMediaSectionSessionSlice,
} from "./types.js";

export const TIMED_MEDIA_SLICE_VERSION = 1 as const;

/**
 * How far past the furthest reached position a seek may land before it is
 * clamped. A native element reports `currentTime` from `timeupdate`, which fires
 * about four times a second, so the furthest recorded position trails real
 * playback by up to a quarter second; clamping at exactly the recorded value
 * would fight a learner nudging the scrubber where they already are.
 */
const SEEK_AHEAD_TOLERANCE_SECONDS = 0.5;

/** Media positions are compared in seconds; a millisecond is below resolution. */
const TIME_EPSILON_SECONDS = 1e-3;

export function createTimedMediaState(): TimedMediaSectionSessionSlice {
	return {
		version: TIMED_MEDIA_SLICE_VERSION,
		mediaCurrentTime: 0,
		maxPositionSeconds: 0,
		mediaCompleted: false,
		visitedCueIdentifiers: [],
		completedCueIdentifiers: [],
		aggregateComplete: false,
	};
}

function toFiniteSeconds(value: unknown, fallback: number): number {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || numeric < 0) return fallback;
	return numeric;
}

/**
 * A cue is reached once playback has passed its start, and stays reached.
 *
 * The end bound does not un-reach it, and seeking past a cue's whole window still
 * reaches it. That is deliberate: the alternative lets a learner who is allowed
 * to seek ahead jump over a checkpoint the author wrote, and a gate that can be
 * skipped is not a gate.
 */
function isCueReached(cue: ResolvedTimedMediaCue, seconds: number): boolean {
	return seconds + TIME_EPSILON_SECONDS >= cue.range.startSeconds;
}

/**
 * Whether one item satisfies a gate condition.
 *
 * `undefined` correctness is "no Try yet" and never satisfies a correctness
 * condition. `"unknown"` is an item no loaded controller can score, and the
 * authored `onUnknownCorrectness` decides it — never collapsed into
 * `"incorrect"`, which would hold a learner behind an item nothing can release.
 */
function itemSatisfiesGate(
	cue: ResolvedTimedMediaCue,
	itemId: string,
	delivery: TimedMediaDeliveryState,
): boolean {
	if (cue.releaseOn === "responded") {
		return delivery.respondedByItemId[itemId] === true;
	}
	const correctness: FormativeCorrectness | undefined =
		delivery.correctnessByItemId[itemId];
	if (correctness === undefined) return false;
	if (correctness === "unknown") return cue.onUnknownCorrectness === "release";
	if (cue.releaseOn === "correct") return correctness === "correct";
	return correctness === "correct" || correctness === "partial";
}

/** Every item a gate names has to satisfy it; one unanswered item still holds. */
function isGateReleased(
	cue: ResolvedTimedMediaCue,
	delivery: TimedMediaDeliveryState,
): boolean {
	if (cue.itemRefs.length === 0) return true;
	return cue.itemRefs.every((itemId) =>
		itemSatisfiesGate(cue, itemId, delivery),
	);
}

function sameStringList(
	left: readonly string[],
	right: readonly string[],
): boolean {
	if (left.length !== right.length) return false;
	return left.every((value, index) => value === right[index]);
}

/**
 * Advance cue state.
 *
 * Two things are monotonic by design. A cue stays visited and its items stay
 * revealed once reached, because un-revealing an item a learner has already
 * answered would take a response off the screen. And a released gate stays
 * complete, so a retry that lowers correctness cannot re-trap a learner
 * mid-playback — the same reasoning that keeps `firstCorrectTry` from being
 * overwritten by a later incorrect Try.
 */
export function reduceTimedMediaState(args: {
	state: TimedMediaSectionSessionSlice;
	data: ResolvedTimedMediaSectionData;
	delivery: TimedMediaDeliveryState;
	input: TimedMediaInput;
}): TimedMediaReduction {
	const { state, data, delivery, input } = args;
	const effects: TimedMediaEffects = { pause: false };

	let nextTime = state.mediaCurrentTime;
	let mediaCompleted = state.mediaCompleted;

	switch (input.kind) {
		case "time":
			nextTime = toFiniteSeconds(
				input.currentTimeSeconds,
				state.mediaCurrentTime,
			);
			break;
		case "seek": {
			const requested = toFiniteSeconds(
				input.currentTimeSeconds,
				state.mediaCurrentTime,
			);
			if (
				!data.playbackPolicy.allowSeekAhead &&
				requested >
					state.maxPositionSeconds + SEEK_AHEAD_TOLERANCE_SECONDS
			) {
				effects.seekToSeconds = state.maxPositionSeconds;
				nextTime = state.maxPositionSeconds;
			} else {
				nextTime = requested;
			}
			break;
		}
		case "ended":
			nextTime = toFiniteSeconds(
				input.currentTimeSeconds,
				state.mediaCurrentTime,
			);
			mediaCompleted = true;
			break;
		case "delivery-changed":
			break;
	}

	const maxPositionSeconds = Math.max(state.maxPositionSeconds, nextTime);

	const visitedCueIdentifiers = [...state.visitedCueIdentifiers];
	const visitedSet = new Set(visitedCueIdentifiers);
	for (const cue of data.cues) {
		if (visitedSet.has(cue.identifier)) continue;
		if (!isCueReached(cue, nextTime)) continue;
		visitedSet.add(cue.identifier);
		visitedCueIdentifiers.push(cue.identifier);
		// Only the last activation of a reduction is reported: a seek that crosses
		// several cues at once has one place for focus to go, and that is the
		// furthest one, which is where the learner now is.
		effects.activatedCueIdentifier = cue.identifier;
	}

	const completedSet = new Set(state.completedCueIdentifiers);
	let holdingGate: ResolvedTimedMediaCue | null = null;
	for (const cue of data.cues) {
		if (!visitedSet.has(cue.identifier)) continue;
		if (completedSet.has(cue.identifier)) continue;
		if (!cue.holdsPlayback) {
			// A reveal or metadata cue has no condition to satisfy, and a gate under
			// `pauseOnRequiredCue: false` has had its hold switched off wholesale.
			completedSet.add(cue.identifier);
			continue;
		}
		if (isGateReleased(cue, delivery)) {
			completedSet.add(cue.identifier);
			effects.releasedCueIdentifier = cue.identifier;
			continue;
		}
		// Authored order decides which of two open gates holds, and only the first
		// one does — playback is stopped either way, and reporting both would give
		// the layout two places to send focus.
		if (!holdingGate) holdingGate = cue;
	}

	const completedCueIdentifiers = data.cues
		.map((cue) => cue.identifier)
		.filter((identifier) => completedSet.has(identifier));

	effects.pause = holdingGate !== null;

	const activeCueIdentifier =
		holdingGate?.identifier ??
		visitedCueIdentifiers[visitedCueIdentifiers.length - 1];

	const aggregateComplete =
		completedCueIdentifiers.length === data.cues.length &&
		delivery.itemsComplete &&
		(data.playbackPolicy.requireMediaCompletion ? mediaCompleted : true);

	const next: TimedMediaSectionSessionSlice = {
		version: TIMED_MEDIA_SLICE_VERSION,
		mediaCurrentTime: nextTime,
		maxPositionSeconds,
		mediaCompleted,
		visitedCueIdentifiers,
		completedCueIdentifiers,
		activeCueIdentifier,
		aggregateComplete,
	};

	const changed =
		next.mediaCurrentTime !== state.mediaCurrentTime ||
		next.maxPositionSeconds !== state.maxPositionSeconds ||
		next.mediaCompleted !== state.mediaCompleted ||
		next.activeCueIdentifier !== state.activeCueIdentifier ||
		next.aggregateComplete !== state.aggregateComplete ||
		!sameStringList(next.visitedCueIdentifiers, state.visitedCueIdentifiers) ||
		!sameStringList(next.completedCueIdentifiers, state.completedCueIdentifiers);

	return { state: changed ? next : state, effects, changed };
}

/**
 * Which policies the attached port can actually carry out.
 *
 * Absent a port there is nothing to degrade *from* yet, so an unattached section
 * reports its authored intent rather than a capability gap it has not measured.
 */
export function resolveTimedMediaEnforcement(args: {
	playbackPolicy: ResolvedTimedMediaSectionData["playbackPolicy"];
	capabilities: MediaTimeSourceCapabilities | null;
	hasGate: boolean;
}): {
	pause: "enforced" | "advisory";
	seek: "enforced" | "advisory";
	degradations: TimedMediaDegradation[];
} {
	const degradations: TimedMediaDegradation[] = [];
	const wantsPause = args.playbackPolicy.pauseOnRequiredCue && args.hasGate;
	const wantsSeekLock = !args.playbackPolicy.allowSeekAhead;

	const canPause = args.capabilities ? args.capabilities.canPause : true;
	const canRestrictSeeking = args.capabilities
		? args.capabilities.canRestrictSeeking
		: true;

	if (wantsPause && !canPause) {
		degradations.push({
			policy: "pause-on-required-cue",
			capability: "canPause",
			message:
				"The media time source cannot pause, so gate cues are advisory: they fire and record state, and playback continues.",
		});
	}
	if (wantsSeekLock && !canRestrictSeeking) {
		degradations.push({
			policy: "restrict-seek-ahead",
			capability: "canRestrictSeeking",
			message:
				"The media time source cannot restrict seeking, so allowSeekAhead: false is advisory: a learner can seek past cues.",
		});
	}

	return {
		pause: wantsPause && !canPause ? "advisory" : "enforced",
		seek: wantsSeekLock && !canRestrictSeeking ? "advisory" : "enforced",
		degradations,
	};
}

/** The gate a layout renders, or `null` when nothing is holding. */
function resolveGateView(args: {
	data: ResolvedTimedMediaSectionData;
	state: TimedMediaSectionSessionSlice;
	delivery: TimedMediaDeliveryState;
	pauseEnforcement: "enforced" | "advisory";
}): TimedMediaGateView | null {
	const visited = new Set(args.state.visitedCueIdentifiers);
	const completed = new Set(args.state.completedCueIdentifiers);
	for (const cue of args.data.cues) {
		if (!cue.holdsPlayback || !cue.releaseOn) continue;
		if (!visited.has(cue.identifier)) continue;
		if (completed.has(cue.identifier)) continue;
		return {
			cueIdentifier: cue.identifier,
			itemRefs: [...cue.itemRefs],
			releaseOn: cue.releaseOn,
			holding: !isGateReleased(cue, args.delivery),
			enforcement: args.pauseEnforcement,
		};
	}
	return null;
}

/** Canonical ids of items a visited cue has revealed, in cue order. */
function resolveRevealedItemIds(
	data: ResolvedTimedMediaSectionData,
	state: TimedMediaSectionSessionSlice,
): string[] {
	const visited = new Set(state.visitedCueIdentifiers);
	const revealed: string[] = [];
	for (const cue of data.cues) {
		if (cue.activation === "metadata") continue;
		if (!visited.has(cue.identifier)) continue;
		for (const itemId of cue.itemRefs) {
			if (!revealed.includes(itemId)) revealed.push(itemId);
		}
	}
	return revealed;
}

/**
 * Derive the view layouts read. Recomputed from state on every republish rather
 * than stored, so there is one source of truth and no mirror to go stale.
 */
export function resolveTimedMediaProjection(args: {
	data: ResolvedTimedMediaSectionData;
	state: TimedMediaSectionSessionSlice;
	delivery: TimedMediaDeliveryState;
	capabilities: MediaTimeSourceCapabilities | null;
}): TimedMediaSectionProjection {
	const hasGate = args.data.cues.some((cue) => cue.activation === "gate");
	const enforcement = resolveTimedMediaEnforcement({
		playbackPolicy: args.data.playbackPolicy,
		capabilities: args.capabilities,
		hasGate,
	});
	return {
		version: 1,
		stimulusRenderableId: args.data.stimulusRenderableId,
		cues: args.data.cues,
		playbackPolicy: args.data.playbackPolicy,
		mediaAttached: args.capabilities !== null,
		enforcement: { pause: enforcement.pause, seek: enforcement.seek },
		degradations: enforcement.degradations,
		revealedItemIds: resolveRevealedItemIds(args.data, args.state),
		activeCueIdentifier: args.state.activeCueIdentifier,
		gate: resolveGateView({
			data: args.data,
			state: args.state,
			delivery: args.delivery,
			pauseEnforcement: enforcement.pause,
		}),
		visitedCueIdentifiers: [...args.state.visitedCueIdentifiers],
		completedCueIdentifiers: [...args.state.completedCueIdentifiers],
		mediaCurrentTime: args.state.mediaCurrentTime,
		maxPositionSeconds: args.state.maxPositionSeconds,
		mediaCompleted: args.state.mediaCompleted,
		aggregateComplete: args.state.aggregateComplete === true,
	};
}
