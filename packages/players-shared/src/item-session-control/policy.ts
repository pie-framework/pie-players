import type {
	ItemSessionControlPolicy,
	FeedbackReveal,
	FeedbackRevealTiming,
	TryLimit,
	ResolvedItemSessionControlPolicy,
} from "./types.js";

/**
 * Built-in defaults. `enabled: false` is what makes this contract invisible to
 * every section authored before it: an absent `itemSessionControl` field resolves to a
 * disabled policy, and a disabled policy produces no state, no projection and
 * no control.
 *
 * `maxTries: 1` matches QTI 3's `qti-item-session-control@max-attempts` default.
 */
export const ITEM_SESSION_CONTROL_DEFAULTS: ResolvedItemSessionControlPolicy = {
	enabled: false,
	maxTries: 1,
	feedback: "correctness",
	revealOn: "on-try",
};

function normalizeTryLimit(value: unknown): TryLimit | undefined {
	if (value === "unlimited") return "unlimited";
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
	const rounded = Math.trunc(value);
	// Zero and negatives are meaningless here rather than shorthand for
	// unlimited. QTI spells unlimited as `max-attempts="0"`; the adapter
	// translates, this contract does not overload the number.
	return rounded >= 1 ? rounded : undefined;
}

function normalizeFeedback(value: unknown): FeedbackReveal | undefined {
	return value === "none" || value === "correctness" || value === "solution"
		? value
		: undefined;
}

function normalizeRevealTiming(
	value: unknown,
): FeedbackRevealTiming | undefined {
	return value === "on-try" || value === "on-final-try" ? value : undefined;
}

/**
 * Merge built-in defaults, the section policy, and one item ref's override, in
 * that order. Each field overrides independently, which is the order QTI 3 uses
 * for `qti-item-session-control` on a section and on an item ref.
 *
 * Unrecognized values fall through to the layer beneath rather than failing the
 * section: authored policy is host-supplied data, and a typo in one field should
 * not cost the learner the whole item.
 */
export function resolveItemSessionControl(
	sectionPolicy?: ItemSessionControlPolicy | null,
	itemPolicy?: ItemSessionControlPolicy | null,
): ResolvedItemSessionControlPolicy {
	const enabled =
		typeof itemPolicy?.enabled === "boolean"
			? itemPolicy.enabled
			: typeof sectionPolicy?.enabled === "boolean"
				? sectionPolicy.enabled
				: ITEM_SESSION_CONTROL_DEFAULTS.enabled;

	const maxTries =
		normalizeTryLimit(itemPolicy?.maxTries) ??
		normalizeTryLimit(sectionPolicy?.maxTries) ??
		ITEM_SESSION_CONTROL_DEFAULTS.maxTries;

	const feedback =
		normalizeFeedback(itemPolicy?.feedback) ??
		normalizeFeedback(sectionPolicy?.feedback) ??
		ITEM_SESSION_CONTROL_DEFAULTS.feedback;

	const requestedRevealOn =
		normalizeRevealTiming(itemPolicy?.revealOn) ??
		normalizeRevealTiming(sectionPolicy?.revealOn) ??
		ITEM_SESSION_CONTROL_DEFAULTS.revealOn;

	// `"on-final-try"` has no referent under unlimited Tries — there is no final
	// Try to reveal on — so it resolves to the only reading that keeps feedback
	// reachable.
	const revealOn: FeedbackRevealTiming =
		requestedRevealOn === "on-final-try" && maxTries === "unlimited"
			? "on-try"
			: requestedRevealOn;

	return { enabled, maxTries, feedback, revealOn };
}

/**
 * Resolve one policy per item in section order.
 *
 * Keyed by the identifier the caller supplies, which in the section runtime is
 * the canonical item id — the same key `itemSessions` and the completion map
 * use, so Try state and an item session are always addressable by one
 * id.
 */
export function resolveItemSessionControls(args: {
	sectionPolicy?: ItemSessionControlPolicy | null;
	items: ReadonlyArray<{
		identifier: string;
		policy?: ItemSessionControlPolicy | null;
	}>;
}): Record<string, ResolvedItemSessionControlPolicy> {
	const resolved: Record<string, ResolvedItemSessionControlPolicy> = {};
	for (const item of args.items) {
		if (!item?.identifier) continue;
		resolved[item.identifier] = resolveItemSessionControl(
			args.sectionPolicy,
			item.policy,
		);
	}
	return resolved;
}

/** True when at least one item in the section enables item session control. */
export function isItemSessionControlEnabledInSection(
	policies: Record<string, ResolvedItemSessionControlPolicy>,
): boolean {
	return Object.values(policies).some((policy) => policy.enabled);
}
