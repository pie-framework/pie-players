/**
 * Validation for authored timed-media section data.
 *
 * Authored, wire-facing and untrusted, so every field is checked here and the
 * caller never hand-parses. Errors are returned rather than thrown: the section
 * reports them as a framework error and delivers as an ordinary section, which is
 * loud without costing the learner the content.
 */

import type { MediaFragmentRange } from "../types/index.js";
import type {
	ResolvedTimedMediaCue,
	TimedMediaItemTryBudget,
	TimedMediaCueActivation,
	TimedMediaGateCondition,
	TimedMediaPlaybackPolicy,
	TimedMediaScoringPolicy,
	TimedMediaUnknownCorrectness,
	TimedMediaValidationError,
	TimedMediaValidationResult,
} from "./types.js";

/**
 * Applied when `playbackPolicy` is absent entirely. The restrictive values are
 * the defaults because a timed-media section is authored to sequence: a section
 * that forgot the policy block reads as one that wanted sequencing, and the
 * permissive reading would silently deliver an unsequenced video.
 */
export const TIMED_MEDIA_PLAYBACK_POLICY_DEFAULTS: TimedMediaPlaybackPolicy = {
	allowSeekAhead: false,
	pauseOnRequiredCue: true,
	requireMediaCompletion: false,
};

const ACTIVATIONS: readonly TimedMediaCueActivation[] = [
	"reveal",
	"gate",
	"metadata",
];

const GATE_CONDITIONS: readonly TimedMediaGateCondition[] = [
	"responded",
	"correct",
	"partial-or-better",
];

const UNKNOWN_CORRECTNESS: readonly TimedMediaUnknownCorrectness[] = [
	"release",
	"hold",
];

const SCORING_STRATEGIES: readonly TimedMediaScoringPolicy["strategy"][] = [
	"sum-child-outcomes",
	"average-child-outcomes",
	"weighted-child-outcomes",
	"host-defined",
];

/** A gate on correctness has to say what an unscorable item does. */
function isCorrectnessCondition(condition: TimedMediaGateCondition): boolean {
	return condition === "correct" || condition === "partial-or-better";
}

function trimmed(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function normalizeRange(value: unknown): MediaFragmentRange | null {
	if (!value || typeof value !== "object") return null;
	const raw = value as Partial<MediaFragmentRange>;
	const start = Number(raw.startSeconds);
	if (!Number.isFinite(start) || start < 0) return null;
	const end = Number(raw.endSeconds);
	// An end at or before the start is a window that can never contain a
	// position, so it is treated as no end — the same rule
	// `normalizeMediaFragment` applies in the toolkit, kept identical on purpose.
	if (!Number.isFinite(end) || end <= start) return { startSeconds: start };
	return { startSeconds: start, endSeconds: end };
}

function normalizePlaybackPolicy(value: unknown): {
	policy: TimedMediaPlaybackPolicy;
	error: TimedMediaValidationError | null;
} {
	if (value === undefined || value === null) {
		return { policy: { ...TIMED_MEDIA_PLAYBACK_POLICY_DEFAULTS }, error: null };
	}
	if (typeof value !== "object") {
		return {
			policy: { ...TIMED_MEDIA_PLAYBACK_POLICY_DEFAULTS },
			error: {
				code: "invalid-playback-policy",
				message: "timedMedia.playbackPolicy must be an object.",
			},
		};
	}
	const raw = value as Partial<TimedMediaPlaybackPolicy>;
	return {
		policy: {
			allowSeekAhead:
				typeof raw.allowSeekAhead === "boolean"
					? raw.allowSeekAhead
					: TIMED_MEDIA_PLAYBACK_POLICY_DEFAULTS.allowSeekAhead,
			pauseOnRequiredCue:
				typeof raw.pauseOnRequiredCue === "boolean"
					? raw.pauseOnRequiredCue
					: TIMED_MEDIA_PLAYBACK_POLICY_DEFAULTS.pauseOnRequiredCue,
			requireMediaCompletion:
				typeof raw.requireMediaCompletion === "boolean"
					? raw.requireMediaCompletion
					: TIMED_MEDIA_PLAYBACK_POLICY_DEFAULTS.requireMediaCompletion,
		},
		error: null,
	};
}

function normalizeScoringPolicy(value: unknown): {
	policy: TimedMediaScoringPolicy | undefined;
	error: TimedMediaValidationError | null;
} {
	if (value === undefined || value === null) {
		return { policy: undefined, error: null };
	}
	const strategy =
		value && typeof value === "object"
			? (value as Partial<TimedMediaScoringPolicy>).strategy
			: undefined;
	const known = SCORING_STRATEGIES.find((candidate) => candidate === strategy);
	if (!known) {
		return {
			policy: undefined,
			error: {
				code: "invalid-scoring-policy",
				message: `timedMedia.scoringPolicy.strategy must be one of ${SCORING_STRATEGIES.join(", ")}.`,
			},
		};
	}
	return { policy: { strategy: known }, error: null };
}

/**
 * Validate authored `timedMedia` against the section it belongs to.
 *
 * `resolveStimulusRenderableId` is supplied by the caller because the mapping
 * from an authored `stimulusRef` to a rendered renderable id belongs to the
 * content service that assigned that id — deriving it twice is two
 * implementations of one mapping.
 */
export function normalizeTimedMediaSectionData(args: {
	timedMedia: unknown;
	/** Canonical identifiers of the section's item refs. */
	itemIdentifiers: readonly string[];
	resolveStimulusRenderableId: (stimulusRef: string) => string | undefined;
	/**
	 * The Try budget each item's resolved formative policy leaves, so a gate on
	 * correctness can be refused where it would strand the learner. Supplied by the
	 * caller because formative policy resolution is that contract's, not this one's.
	 */
	resolveItemTryBudget: (itemIdentifier: string) => TimedMediaItemTryBudget;
}): TimedMediaValidationResult {
	const errors: TimedMediaValidationError[] = [];
	if (!args.timedMedia || typeof args.timedMedia !== "object") {
		return {
			data: null,
			errors: [
				{
					code: "missing-stimulus-ref",
					message: "timedMedia must be an object carrying a stimulusRef.",
				},
			],
		};
	}
	const raw = args.timedMedia as Record<string, unknown>;

	const stimulusRef = trimmed(raw.stimulusRef);
	if (!stimulusRef) {
		errors.push({
			code: "missing-stimulus-ref",
			message: "timedMedia.stimulusRef is required.",
		});
	}
	const stimulusRenderableId = stimulusRef
		? args.resolveStimulusRenderableId(stimulusRef)
		: undefined;
	if (stimulusRef && !stimulusRenderableId) {
		errors.push({
			code: "unresolved-stimulus-ref",
			message: `timedMedia.stimulusRef "${stimulusRef}" does not name a renderable in this section.`,
		});
	}

	const { policy: playbackPolicy, error: playbackError } =
		normalizePlaybackPolicy(raw.playbackPolicy);
	if (playbackError) errors.push(playbackError);
	const { policy: scoringPolicy, error: scoringError } = normalizeScoringPolicy(
		raw.scoringPolicy,
	);
	if (scoringError) errors.push(scoringError);

	const allowedItemIds = new Set(args.itemIdentifiers);
	const rawCues = Array.isArray(raw.cues) ? raw.cues : [];
	if (rawCues.length === 0) {
		errors.push({
			code: "no-cues",
			message: "timedMedia.cues must hold at least one cue.",
		});
	}

	const seenIdentifiers = new Set<string>();
	const cues: ResolvedTimedMediaCue[] = [];
	for (const [index, entry] of rawCues.entries()) {
		const cue = (entry ?? {}) as Record<string, unknown>;
		const identifier = trimmed(cue.identifier);
		if (!identifier) {
			errors.push({
				code: "invalid-cue-identifier",
				message: `timedMedia.cues[${index}] has no identifier.`,
			});
			continue;
		}
		if (seenIdentifiers.has(identifier)) {
			errors.push({
				code: "duplicate-cue-identifier",
				message: `Cue identifier "${identifier}" appears more than once.`,
				cueIdentifier: identifier,
			});
			continue;
		}
		seenIdentifiers.add(identifier);

		const range = normalizeRange(cue.range);
		if (!range) {
			errors.push({
				code: "invalid-cue-range",
				message: `Cue "${identifier}" needs a range with a finite, non-negative startSeconds.`,
				cueIdentifier: identifier,
			});
			continue;
		}

		const cuePolicy = (cue.policy ?? {}) as Record<string, unknown>;
		const activation = ACTIVATIONS.find(
			(candidate) => candidate === cuePolicy.activation,
		);
		if (!activation) {
			errors.push({
				code: "invalid-cue-activation",
				message: `Cue "${identifier}" needs policy.activation of ${ACTIVATIONS.join(", ")}.`,
				cueIdentifier: identifier,
			});
			continue;
		}

		const rawItemRefs = Array.isArray(cue.itemRefs) ? cue.itemRefs : [];
		const itemRefs: string[] = [];
		for (const rawItemRef of rawItemRefs) {
			const itemRef = trimmed(rawItemRef);
			if (!itemRef) continue;
			if (!allowedItemIds.has(itemRef)) {
				// Reported rather than dropped quietly: a cue naming an item the
				// section does not hold is the exact authoring slip that produces a
				// checkpoint the learner never sees.
				errors.push({
					code: "unknown-item-ref",
					message: `Cue "${identifier}" names item ref "${itemRef}", which is not in this section.`,
					cueIdentifier: identifier,
				});
				continue;
			}
			if (!itemRefs.includes(itemRef)) itemRefs.push(itemRef);
		}
		if (itemRefs.length === 0 && activation !== "metadata") {
			errors.push({
				code: "missing-item-refs",
				message: `Cue "${identifier}" activates no item; only a metadata cue may name none.`,
				cueIdentifier: identifier,
			});
			continue;
		}

		let releaseOn: TimedMediaGateCondition | undefined;
		let onUnknownCorrectness: TimedMediaUnknownCorrectness | undefined;
		if (activation === "gate") {
			releaseOn = GATE_CONDITIONS.find(
				(candidate) => candidate === cuePolicy.releaseOn,
			);
			if (!releaseOn) {
				errors.push({
					code: "missing-release-condition",
					message: `Gate cue "${identifier}" needs policy.releaseOn of ${GATE_CONDITIONS.join(", ")}.`,
					cueIdentifier: identifier,
				});
				continue;
			}
			if (isCorrectnessCondition(releaseOn)) {
				onUnknownCorrectness = UNKNOWN_CORRECTNESS.find(
					(candidate) => candidate === cuePolicy.onUnknownCorrectness,
				);
				if (!onUnknownCorrectness) {
					errors.push({
						code: "missing-unknown-correctness",
						message: `Gate cue "${identifier}" releases on correctness, so policy.onUnknownCorrectness must state "release" or "hold" for an item no controller can score.`,
						cueIdentifier: identifier,
					});
					continue;
				}
				// A correctness gate is only passable while the learner still has a Try
				// to spend. Over an item with a finite budget the gate becomes
				// unpassable the moment the budget runs out, and over an item that does
				// not deliver formatively there is never a Try at all — in both cases
				// nothing the learner can do releases playback, and no host action
				// releases it either, because a forced reveal is not a correct answer.
				// Refused here rather than released at runtime: releasing would deliver
				// the opposite of what the author wrote, which is the silent degradation
				// this contract exists to avoid.
				const unpassable = itemRefs.filter(
					(itemRef) => args.resolveItemTryBudget(itemRef) !== "unlimited",
				);
				if (unpassable.length > 0) {
					errors.push({
						code: "gate-requires-unlimited-tries",
						message: `Gate cue "${identifier}" releases on correctness, so every item it names needs formative delivery with maxTries: "unlimited" — otherwise a learner who runs out of Tries can never release playback. Offending item refs: ${unpassable.join(", ")}.`,
						cueIdentifier: identifier,
					});
					continue;
				}
			}
		}

		cues.push({
			identifier,
			range,
			itemRefs,
			activation,
			releaseOn,
			onUnknownCorrectness,
			// A policy that switched pausing off wholesale turns every gate into a
			// reveal, which is the author's own choice and needs no warning.
			holdsPlayback: activation === "gate" && playbackPolicy.pauseOnRequiredCue,
		});
	}

	if (errors.length > 0) return { data: null, errors };

	return {
		data: {
			stimulusRef,
			stimulusRenderableId: stimulusRenderableId ?? "",
			// Cue order is authored order, not time order: two cues may share a start
			// and the author's sequence decides which gate holds first.
			cues,
			playbackPolicy,
			scoringPolicy,
		},
		errors: [],
	};
}
