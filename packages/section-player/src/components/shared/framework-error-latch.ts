import type { FrameworkErrorModel } from "@pie-players/pie-assessment-toolkit";

/**
 * The section player's readiness error latch. A non-recoverable framework error
 * latches the scope its report site set: a `cohort` error fails the section it
 * was reported for and clears when the cohort rolls; a `runtime` error fails
 * every later section, since they run on the same coordinator. A recoverable
 * error latches nothing.
 */
export type FrameworkErrorLatch = {
	readonly cohort: boolean;
	readonly runtime: boolean;
};

export const CLEAR_FRAMEWORK_ERROR_LATCH: FrameworkErrorLatch = {
	cohort: false,
	runtime: false,
};

export function latchFrameworkError(
	latch: FrameworkErrorLatch,
	detail: Pick<FrameworkErrorModel, "recoverable" | "scope"> | null | undefined,
): FrameworkErrorLatch {
	if (!detail || detail.recoverable === true) return latch;
	return detail.scope === "cohort"
		? { ...latch, cohort: true }
		: { ...latch, runtime: true };
}

export function rollFrameworkErrorLatch(
	latch: FrameworkErrorLatch,
): FrameworkErrorLatch {
	return { cohort: false, runtime: latch.runtime };
}

export function isFrameworkErrorLatched(latch: FrameworkErrorLatch): boolean {
	return latch.cohort || latch.runtime;
}
