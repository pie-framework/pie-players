/**
 * Formative delivery vocabulary.
 *
 * A **Try** is one submitted-for-checking pass over a single item. It is not
 * `TestAttemptSession` (the assessment administration) and not
 * `TestAttemptItemSession.attemptCount` (a count of distinct PIE session ids for
 * an item). Both of those already own the word "attempt" in this codebase, at
 * two different scopes, which is why this contract does not use it.
 *
 * See `docs/prds/formative-delivery-contract.md` for the ratified contract and
 * its QTI 3 mapping.
 */

/** How many Tries a learner gets on one item. */
export type FormativeTryLimit = number | "unlimited";

/**
 * What the learner sees after a Try.
 *
 * PIE does not render feedback — it selects the render mode the element already
 * implements. `"correctness"` projects `role: "student"`, `"solution"` projects
 * `role: "instructor"`, which is the element convention for additionally
 * revealing the authored correct response.
 */
export type FormativeFeedbackReveal = "none" | "correctness" | "solution";

/** When a reveal happens: after every Try, or only once Tries are spent. */
export type FormativeRevealTiming = "on-try" | "on-final-try";

/**
 * Authored policy. Lives on `AssessmentSection.formative` as the section
 * default and on `AssessmentItemRef.formative` as a per-item override.
 */
export interface FormativeDeliveryPolicy {
	/**
	 * Absent or `false` leaves delivery exactly as it is without this contract:
	 * no control, no projection, no state.
	 */
	enabled?: boolean;
	/** Default 1. */
	maxTries?: FormativeTryLimit;
	/** Default `"correctness"`. */
	feedback?: FormativeFeedbackReveal;
	/** Default `"on-try"`. */
	revealOn?: FormativeRevealTiming;
}

/** Same shape as the section policy; every field overrides independently. */
export type FormativeItemPolicy = FormativeDeliveryPolicy;

/** The policy after built-in defaults, section, and item ref are merged. */
export interface ResolvedFormativePolicy {
	enabled: boolean;
	maxTries: FormativeTryLimit;
	feedback: FormativeFeedbackReveal;
	revealOn: FormativeRevealTiming;
}

/**
 * `"unknown"` is the honest state for an item no loaded controller can score —
 * one holding a rubric element, or one whose element bundle exposes no
 * `outcome`. It is never collapsed into `"incorrect"`.
 */
export type FormativeCorrectness =
	| "correct"
	| "partial"
	| "incorrect"
	| "unknown";

/**
 * The subset of an element outcome that aggregation reads. `OutcomeResponse` is
 * assignable to this; the structural type keeps this module free of a
 * dependency on the entity types, which import policy types from here.
 */
export interface FormativeScoredOutcome {
	score?: number;
	max?: number;
	[key: string]: unknown;
}

/** The recorded result of one Try. */
export interface FormativeTryOutcome {
	correctness: FormativeCorrectness;
	points?: number;
	max?: number;
	scoredElementCount: number;
	totalElementCount: number;
	/**
	 * The per-element outcomes the aggregate was derived from, for a host that
	 * renders its own feedback instead of the element's evaluate-mode rendering.
	 *
	 * Element-shaped and unvalidated beyond "an object" — each entry carries
	 * whatever that element's controller returned, keyed to a model by its own
	 * `id`. Empty slots (`provideScore()` leaves one per model with no element or
	 * controller) are dropped; `totalElementCount` still counts them.
	 *
	 * A trade: this persists inside the session slice, so a snapshot grows by
	 * whatever the elements put in their outcomes — some include a scoring trace.
	 */
	elementOutcomes?: FormativeScoredOutcome[];
}

/** Per-item delivery state. Persisted; see `FormativeSectionSlice`. */
export interface FormativeItemState {
	version: 1;
	itemIdentifier: string;
	tryCount: number;
	/**
	 * Whether feedback is on screen right now. Live delivery state rather than a
	 * fact about the response: it distinguishes "checked, feedback shown,
	 * editing locked" from "editable again after a retry", and it persists so a
	 * reload restores the screen the learner left.
	 */
	revealed: boolean;
	lastOutcome?: FormativeTryOutcome;
	/** 1-based Try on which the item first scored full credit. Never overwritten. */
	firstCorrectTry?: number;
	/**
	 * Reveal level in force for this item, when a host forced the reveal rather
	 * than the learner earning it. Overrides the policy's `feedback` for the env
	 * projection only — the policy still decides Tries.
	 *
	 * Set by `revealFormativeItem`, cleared by `hideFormativeItem` and by a
	 * learner retry, so a teacher-driven "show the answer" does not silently
	 * upgrade every later reveal on that item.
	 */
	revealOverride?: FormativeFeedbackReveal;
}

/** The persisted slice, carried on `SectionControllerSessionState.formative`. */
export interface FormativeSectionSlice {
	version: 1;
	items: Record<string, FormativeItemState>;
}

/** Projected over the section env for one revealed item. */
export interface FormativeEnvOverride {
	mode: "evaluate";
	role: "student" | "instructor";
}

/**
 * What a rendering component needs, derived once so no component reimplements
 * the predicate. Carries no copy — wording belongs to the rendering package.
 */
export interface FormativeItemView {
	enabled: boolean;
	tryCount: number;
	triesRemaining: number | "unlimited";
	canCheck: boolean;
	canRetry: boolean;
	revealed: boolean;
	envOverride?: FormativeEnvOverride;
	lastOutcome?: FormativeTryOutcome;
}

/** Section rollup over Try outcomes. */
export interface FormativeMasteryRollup {
	version: 1;
	totalItems: number;
	/**
	 * Items not known to be unscorable — total minus those whose last outcome
	 * was `"unknown"`. An untried item counts here: nothing yet says it cannot
	 * be scored.
	 */
	scorableItems: number;
	masteredItems: number;
	triedItems: number;
	/** Mean `firstCorrectTry` across mastered items. */
	averageTriesToMastery?: number;
	complete: boolean;
}

/** The composition-model projection layouts read. */
export interface FormativeSectionProjection {
	version: 1;
	enabled: boolean;
	policies: Record<string, ResolvedFormativePolicy>;
	states: Record<string, FormativeItemState>;
	mastery: FormativeMasteryRollup;
}

/** The two learner actions a rendering component can request. */
export type FormativeAction = "check" | "retry";
