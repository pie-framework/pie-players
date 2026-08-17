import type {
	FormativeCorrectness,
	FormativeFeedbackReveal,
	FormativeItemState,
	FormativeScoredOutcome,
	FormativeSectionSlice,
	FormativeTryOutcome,
} from "./types.js";
import { FORMATIVE_ITEM_STATE_VERSION } from "./state.js";

export const FORMATIVE_SLICE_VERSION = 1 as const;

const CORRECTNESS_VALUES: readonly FormativeCorrectness[] = [
	"correct",
	"partial",
	"incorrect",
	"unknown",
];

function readFiniteNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

function readNonNegativeInteger(value: unknown): number | undefined {
	const numeric = readFiniteNumber(value);
	if (numeric === undefined) return undefined;
	const rounded = Math.trunc(numeric);
	return rounded >= 0 ? rounded : undefined;
}

function normalizeOutcome(value: unknown): FormativeTryOutcome | undefined {
	if (!value || typeof value !== "object") return undefined;
	const raw = value as Record<string, unknown>;
	const correctness = CORRECTNESS_VALUES.find(
		(candidate) => candidate === raw.correctness,
	);
	if (!correctness) return undefined;
	return {
		correctness,
		points: readFiniteNumber(raw.points),
		max: readFiniteNumber(raw.max),
		scoredElementCount: readNonNegativeInteger(raw.scoredElementCount) ?? 0,
		totalElementCount: readNonNegativeInteger(raw.totalElementCount) ?? 0,
		elementOutcomes: normalizeElementOutcomes(raw.elementOutcomes),
	};
}

/**
 * Element outcomes are element-shaped by contract, so validation stops at "an
 * array of objects". Reaching further would mean this module deciding what an
 * element's outcome may contain, which is the element's business.
 */
function normalizeElementOutcomes(
	value: unknown,
): FormativeScoredOutcome[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const entries = value.filter(
		(entry): entry is FormativeScoredOutcome =>
			!!entry && typeof entry === "object" && !Array.isArray(entry),
	);
	return entries.length > 0 ? entries : undefined;
}

function normalizeRevealOverride(
	value: unknown,
): FormativeFeedbackReveal | undefined {
	return value === "correctness" || value === "solution" || value === "none"
		? value
		: undefined;
}

function normalizeItemState(
	itemIdentifier: string,
	value: unknown,
): FormativeItemState | null {
	if (!value || typeof value !== "object") return null;
	const raw = value as Record<string, unknown>;
	if (raw.version !== FORMATIVE_ITEM_STATE_VERSION) return null;
	const tryCount = readNonNegativeInteger(raw.tryCount);
	if (tryCount === undefined) return null;
	const firstCorrectTry = readNonNegativeInteger(raw.firstCorrectTry);
	return {
		version: FORMATIVE_ITEM_STATE_VERSION,
		itemIdentifier,
		tryCount,
		revealed: raw.revealed === true,
		lastOutcome: normalizeOutcome(raw.lastOutcome),
		firstCorrectTry:
			firstCorrectTry !== undefined && firstCorrectTry >= 1
				? firstCorrectTry
				: undefined,
		revealOverride: normalizeRevealOverride(raw.revealOverride),
	};
}

export function toFormativeSectionSlice(
	states: Record<string, FormativeItemState>,
): FormativeSectionSlice {
	return {
		version: FORMATIVE_SLICE_VERSION,
		items: { ...states },
	};
}

/**
 * Validate a persisted slice against the section it is being restored into.
 *
 * Returns `null` for a slice this build cannot read, which the caller treats as
 * "start formative state clean". Rejection is deliberately narrow: it discards
 * formative progress and nothing else, so a version bump here never costs a
 * learner their responses — item sessions travel in the same snapshot and are
 * normalized separately.
 *
 * An absent slice is `null` too, and indistinguishable from a pre-formative
 * save, which is what keeps existing snapshots valid.
 */
export function normalizeFormativeSectionSlice(args: {
	slice: unknown;
	allowedItemIdentifiers: readonly string[];
}): Record<string, FormativeItemState> | null {
	const { slice } = args;
	if (!slice || typeof slice !== "object") return null;
	const raw = slice as Record<string, unknown>;
	if (raw.version !== FORMATIVE_SLICE_VERSION) return null;
	if (!raw.items || typeof raw.items !== "object") return null;

	const allowed = new Set(args.allowedItemIdentifiers ?? []);
	const normalized: Record<string, FormativeItemState> = {};
	for (const [itemIdentifier, entry] of Object.entries(
		raw.items as Record<string, unknown>,
	)) {
		if (!allowed.has(itemIdentifier)) continue;
		const state = normalizeItemState(itemIdentifier, entry);
		if (!state) continue;
		normalized[itemIdentifier] = state;
	}
	return normalized;
}
