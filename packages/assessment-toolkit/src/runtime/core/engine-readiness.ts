/**
 * Readiness gating for the section runtime engine: which of the host's
 * readiness signals open `interactive` and `loading-complete` under the
 * section's readiness mode.
 */

export type EngineReadinessSignals = {
	sectionReady: boolean;
	interactionReady: boolean;
	allLoadingComplete: boolean;
	runtimeError: boolean;
};

export type EngineReadinessGates = {
	interactionReady: boolean;
	allLoadingComplete: boolean;
};

export function resolveReadinessGates(
	mode: "progressive" | "strict",
	signals: EngineReadinessSignals,
): EngineReadinessGates {
	// Final ready is always gated by the section lifecycle and complete loading.
	const allLoadingComplete = signals.sectionReady && signals.allLoadingComplete;
	return {
		interactionReady:
			mode === "strict" ? allLoadingComplete : signals.interactionReady,
		allLoadingComplete,
	};
}
