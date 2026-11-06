import type {
	FeedbackEnvOverride,
	FeedbackReveal,
	ItemTryState,
	ItemTryView,
	TryOutcome,
	ResolvedItemSessionControl,
} from "./types.js";

export const ITEM_TRY_STATE_VERSION = 1 as const;

export function createItemTryState(
	itemIdentifier: string,
): ItemTryState {
	return {
		version: ITEM_TRY_STATE_VERSION,
		itemIdentifier,
		tryCount: 0,
		revealed: false,
	};
}

function triesRemaining(
	policy: ResolvedItemSessionControl,
	tryCount: number,
): number | "unlimited" {
	if (policy.maxTries === "unlimited") return "unlimited";
	return Math.max(0, policy.maxTries - tryCount);
}

function hasTriesLeft(remaining: number | "unlimited"): boolean {
	return remaining === "unlimited" || remaining > 0;
}

function shouldReveal(
	policy: ResolvedItemSessionControl,
	tryCount: number,
): boolean {
	if (policy.feedback === "none") return false;
	if (policy.revealOn === "on-try") return true;
	// Defensive: `resolveItemSessionControl` already coerces `"on-final-try"` to
	// `"on-try"` under unlimited Tries, so this branch only guards a
	// hand-constructed policy.
	if (policy.maxTries === "unlimited") return true;
	return tryCount >= policy.maxTries;
}

/**
 * Record one Try.
 *
 * Idempotent against a double submit: a Try is only counted when the current
 * state can be checked, so a second click landing before the projection
 * round-trips is dropped rather than spending a Try.
 */
export function recordTry(args: {
	state?: ItemTryState;
	itemIdentifier: string;
	policy: ResolvedItemSessionControl;
	outcome: TryOutcome;
}): ItemTryState {
	const current = args.state ?? createItemTryState(args.itemIdentifier);
	if (!args.policy.enabled) return current;

	const remaining = triesRemaining(args.policy, current.tryCount);
	if (current.revealed || !hasTriesLeft(remaining)) return current;

	const tryCount = current.tryCount + 1;
	return {
		...current,
		version: ITEM_TRY_STATE_VERSION,
		itemIdentifier: args.itemIdentifier,
		tryCount,
		revealed: shouldReveal(args.policy, tryCount),
		lastOutcome: args.outcome,
		// First correct Try is recorded once. A later incorrect Try changes
		// `lastOutcome` but not the fact that the learner got there, which is what
		// mastery counts.
		firstCorrectTry:
			current.firstCorrectTry ??
			(args.outcome.correctness === "correct" ? tryCount : undefined),
	};
}

/**
 * Dismiss a reveal and reopen the item for editing. Withdrawing `revealed` is
 * what withdraws the env override, so the item returns to the section's own
 * mode.
 *
 * A learner action, so it respects the Try budget: an item with none left keeps
 * its feedback on screen. `hideItemFeedback` is the host-authority version.
 */
export function retryItem(args: {
	state?: ItemTryState;
	policy: ResolvedItemSessionControl;
}): ItemTryState | undefined {
	const current = args.state;
	if (!current || !args.policy.enabled) return current;
	if (!current.revealed) return current;
	if (!hasTriesLeft(triesRemaining(args.policy, current.tryCount))) {
		return current;
	}
	return { ...current, revealed: false, revealOverride: undefined };
}

/**
 * Reveal on host authority — a teacher-driven "show the answer".
 *
 * Spends no Try and ignores the Try budget and `revealOn`, because none of those
 * bound a decision the host has already taken. `feedback` is required rather
 * than defaulted from the policy: a forced reveal under `feedback: "none"` would
 * project nothing, so the caller states what to show.
 *
 * Works on an item with no Try yet. The element renders evaluate mode over
 * whatever response is there, including none, which is what "show the answer"
 * means before the learner has answered.
 */
export function revealItemFeedback(args: {
	state?: ItemTryState;
	itemIdentifier: string;
	policy: ResolvedItemSessionControl;
	feedback: Exclude<FeedbackReveal, "none">;
}): ItemTryState {
	const current = args.state ?? createItemTryState(args.itemIdentifier);
	if (!args.policy.enabled) return current;
	if (current.revealed && current.revealOverride === args.feedback) {
		return current;
	}
	return { ...current, revealed: true, revealOverride: args.feedback };
}

/**
 * Withdraw a reveal on host authority. Unlike a learner retry this ignores the
 * Try budget: a host that revealed an item with no Tries left must be able to
 * put it back.
 */
export function hideItemFeedback(args: {
	state?: ItemTryState;
	policy: ResolvedItemSessionControl;
}): ItemTryState | undefined {
	const current = args.state;
	if (!current || !args.policy.enabled) return current;
	if (!current.revealed && !current.revealOverride) return current;
	return { ...current, revealed: false, revealOverride: undefined };
}

function envOverrideFor(
	policy: ResolvedItemSessionControl,
	revealed: boolean,
	revealOverride: FeedbackReveal | undefined,
): FeedbackEnvOverride | undefined {
	const feedback = revealOverride ?? policy.feedback;
	if (!revealed || feedback === "none") return undefined;
	return {
		mode: "evaluate",
		role: feedback === "solution" ? "instructor" : "student",
	};
}

/** Derive everything a rendering component needs from policy plus state. */
export function resolveItemTryView(args: {
	policy: ResolvedItemSessionControl;
	state?: ItemTryState;
}): ItemTryView {
	const { policy } = args;
	const tryCount = args.state?.tryCount ?? 0;
	const revealed = args.state?.revealed === true;
	const remaining = triesRemaining(policy, tryCount);
	const available = policy.enabled && hasTriesLeft(remaining);
	return {
		enabled: policy.enabled,
		tryCount,
		triesRemaining: remaining,
		canCheck: available && !revealed,
		canRetry: available && revealed,
		revealed,
		envOverride: policy.enabled
			? envOverrideFor(policy, revealed, args.state?.revealOverride)
			: undefined,
		lastOutcome: args.state?.lastOutcome,
	};
}
