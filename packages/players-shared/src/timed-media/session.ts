/**
 * Persistence for the timed-media slice.
 *
 * Same posture as the formative slice: an unreadable slice is rejected whole and
 * delivery starts from clean cue state, while item sessions in the same snapshot
 * are normalized separately and survive. A version bump here must never cost a
 * learner their responses.
 */

import type {
	ResolvedTimedMediaSectionData,
	TimedMediaSectionSessionSlice,
} from "./types.js";
import { TIMED_MEDIA_SLICE_VERSION, createTimedMediaState } from "./state.js";

function readNonNegativeNumber(value: unknown): number | undefined {
	const numeric = typeof value === "number" ? value : Number.NaN;
	if (!Number.isFinite(numeric) || numeric < 0) return undefined;
	return numeric;
}

function readIdentifierList(
	value: unknown,
	allowed: ReadonlySet<string>,
): string[] {
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	for (const entry of value) {
		if (typeof entry !== "string") continue;
		const identifier = entry.trim();
		// Filtered against the cues this section actually holds, matching how
		// `normalizeApplySession` filters item sessions: a snapshot taken against
		// an earlier revision of the section must not resurrect a cue that is gone.
		if (!identifier || !allowed.has(identifier)) continue;
		if (out.includes(identifier)) continue;
		out.push(identifier);
	}
	return out;
}

export function toTimedMediaSectionSlice(
	state: TimedMediaSectionSessionSlice,
): TimedMediaSectionSessionSlice {
	return {
		...state,
		version: TIMED_MEDIA_SLICE_VERSION,
		visitedCueIdentifiers: [...state.visitedCueIdentifiers],
		completedCueIdentifiers: [...state.completedCueIdentifiers],
	};
}

/**
 * Validate a persisted slice against the section it is restored into.
 *
 * Returns `null` for an absent slice or one this build cannot read — the caller
 * treats both as "start clean", and the two are indistinguishable, which is what
 * keeps pre-timed-media snapshots valid.
 */
export function normalizeTimedMediaSectionSlice(args: {
	slice: unknown;
	data: ResolvedTimedMediaSectionData | null;
}): TimedMediaSectionSessionSlice | null {
	const { slice, data } = args;
	if (!data) return null;
	if (!slice || typeof slice !== "object") return null;
	const raw = slice as Record<string, unknown>;
	if (raw.version !== TIMED_MEDIA_SLICE_VERSION) return null;

	const allowedCueIds = new Set(data.cues.map((cue) => cue.identifier));
	const base = createTimedMediaState();
	const mediaCurrentTime =
		readNonNegativeNumber(raw.mediaCurrentTime) ?? base.mediaCurrentTime;
	const visitedCueIdentifiers = readIdentifierList(
		raw.visitedCueIdentifiers,
		allowedCueIds,
	);
	const completedCueIdentifiers = readIdentifierList(
		raw.completedCueIdentifiers,
		allowedCueIds,
	);
	const activeCueIdentifier =
		typeof raw.activeCueIdentifier === "string" &&
		allowedCueIds.has(raw.activeCueIdentifier)
			? raw.activeCueIdentifier
			: undefined;

	return {
		version: TIMED_MEDIA_SLICE_VERSION,
		mediaCurrentTime,
		// Never below the restored position: a snapshot written before
		// `maxPositionSeconds` existed, or one carrying a lower value than the
		// position it also records, would hand back timeline the learner already
		// spent under `allowSeekAhead: false`.
		maxPositionSeconds: Math.max(
			readNonNegativeNumber(raw.maxPositionSeconds) ?? 0,
			mediaCurrentTime,
		),
		mediaCompleted: raw.mediaCompleted === true,
		visitedCueIdentifiers,
		// A cue cannot be complete without having been visited; a snapshot that says
		// otherwise is inconsistent, and the visited set is the one that decides what
		// is on screen.
		completedCueIdentifiers: completedCueIdentifiers.filter((identifier) =>
			visitedCueIdentifiers.includes(identifier),
		),
		activeCueIdentifier,
		aggregateComplete: raw.aggregateComplete === true,
	};
}
