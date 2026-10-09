import type { FrameworkErrorModel } from "@pie-players/pie-assessment-toolkit";

/**
 * The section player's readiness error latch. A non-recoverable framework error
 * latches the scope its report site set: a `cohort` error fails the section it
 * was reported for and clears when the cohort rolls; a `runtime` error fails
 * every later section, since they run on the same coordinator. A recoverable
 * error latches nothing.
 *
 * A toolkit bootstrap failure is a runtime error held against the coordinator
 * the toolkit had announced when it was reported. It clears when the toolkit
 * announces a different one, which it builds once the host corrects the input
 * that failed: the coordinator the failure took down is no longer the one later
 * sections run on.
 *
 * `element-preload` latches nothing either. The items pane reports its warmup
 * outcome with the composition it was for, and the kernel reads that instead: a
 * latched event cannot tell which section's warmup failed.
 */
export type FrameworkErrorLatch = {
	readonly cohort: boolean;
	readonly runtime: boolean;
	/** The coordinator a bootstrap failure was reported under, while one is latched. */
	readonly bootstrap: { readonly coordinator: unknown } | null;
};

export const CLEAR_FRAMEWORK_ERROR_LATCH: FrameworkErrorLatch = {
	cohort: false,
	runtime: false,
	bootstrap: null,
};

function isBootstrapKind(kind: FrameworkErrorModel["kind"] | undefined): boolean {
	return (
		kind === "coordinator-init" || kind === "runtime-init" || kind === "tool-config"
	);
}

export function latchFrameworkError(
	latch: FrameworkErrorLatch,
	detail:
		| Pick<FrameworkErrorModel, "recoverable" | "scope" | "kind">
		| null
		| undefined,
	coordinator: unknown,
): FrameworkErrorLatch {
	if (!detail || detail.recoverable === true) return latch;
	if (detail.kind === "element-preload") return latch;
	if (detail.scope === "cohort") return { ...latch, cohort: true };
	if (isBootstrapKind(detail.kind)) {
		return latch.bootstrap ? latch : { ...latch, bootstrap: { coordinator } };
	}
	return { ...latch, runtime: true };
}

export function rollFrameworkErrorLatch(
	latch: FrameworkErrorLatch,
): FrameworkErrorLatch {
	return { ...latch, cohort: false };
}

/** Applied on each `toolkit-ready`, with the coordinator it announces. */
export function announceToolkitCoordinator(
	latch: FrameworkErrorLatch,
	coordinator: unknown,
): FrameworkErrorLatch {
	if (!latch.bootstrap || latch.bootstrap.coordinator === coordinator) return latch;
	return { ...latch, bootstrap: null };
}

export function isFrameworkErrorLatched(latch: FrameworkErrorLatch): boolean {
	return latch.cohort || latch.runtime || latch.bootstrap !== null;
}
