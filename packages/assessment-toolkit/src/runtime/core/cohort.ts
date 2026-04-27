/**
 * Cohort identity for the section runtime engine (M7).
 *
 * One cohort is the tuple `(sectionId, attemptId)` for the section the
 * host is currently rendering. Stage progression, readiness latches, and
 * `pie-loading-complete` emission are all gated on this tuple — when it
 * changes, the engine emits `disposed` for the outgoing cohort and
 * resets to `composed` for the new one.
 *
 * `attemptId` is optional in the public surface (per the toolkit /
 * layout-CE prop shape) but the engine carries it as the empty string
 * when absent so the cohort key is total.
 */

export interface CohortKey {
	/** Section identifier; required for any non-idle cohort. */
	sectionId: string;
	/** Attempt identifier; empty string if the host did not provide one. */
	attemptId: string;
}

/**
 * Stable string form of the cohort tuple used as a key for the
 * `loadingCompleteEmittedForCohort` latch and equality checks.
 */
export function cohortKey(cohort: CohortKey | null): string {
	if (!cohort) return "";
	return `${cohort.sectionId}|${cohort.attemptId}`;
}

/**
 * `true` iff the two cohorts have the same `(sectionId, attemptId)` pair.
 * Treats both inputs as identifying the cohort by value, never by
 * reference.
 */
export function cohortsEqual(a: CohortKey | null, b: CohortKey | null): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return a.sectionId === b.sectionId && a.attemptId === b.attemptId;
}

/**
 * Normalize host-provided `(sectionId, attemptId)` into a cohort. Returns
 * `null` when the section identifier is empty — that is the engine's
 * idle state (no cohort).
 */
export function makeCohort(args: {
	sectionId: string | null | undefined;
	attemptId: string | null | undefined;
}): CohortKey | null {
	const sectionId = args.sectionId ?? "";
	if (!sectionId) return null;
	return {
		sectionId,
		attemptId: args.attemptId ?? "",
	};
}
