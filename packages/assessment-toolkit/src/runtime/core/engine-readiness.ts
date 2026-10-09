/**
 * Readiness derivation for the section runtime engine.
 *
 * Canonical home of `createReadinessDetail` and `resolveReadinessPhase`;
 * section-player consumes them through
 * `@pie-players/pie-assessment-toolkit/runtime/engine`.
 *
 * Type duplication note: the public DOM-event detail aliases
 * (`SectionPlayerReadinessChangeDetail` /
 * `SectionPlayerReadinessPhase`) still live in section-player's
 * `contracts/public-events.ts` because that file is part of section-
 * player's published custom-element contract. The toolkit core defines
 * `EngineReadinessPhase` independently so it has zero section-player
 * imports. The two definitions must stay structurally identical;
 * that invariant is covered by the readiness assertions in this
 * package's tests, which mirror the section-player suite.
 */

/**
 * Coarse readiness phase label, derived from the four readiness
 * signals. Surfaced via the kernel's `selectReadiness()` /
 * `getSnapshot().readiness` selectors. Stage transitions are carried by
 * `pie-stage-change`; this phase is a convenience label only.
 */
export type EngineReadinessPhase =
	| "bootstrapping"
	| "interaction-ready"
	| "loading"
	| "ready"
	| "error";

export type EngineReadinessSignals = {
	sectionReady: boolean;
	interactionReady: boolean;
	allLoadingComplete: boolean;
	runtimeError: boolean;
};

export type EngineReadinessDetail = {
	phase: EngineReadinessPhase;
	interactionReady: boolean;
	allLoadingComplete: boolean;
	reason?: string;
};

export function resolveReadinessPhase(
	signals: EngineReadinessSignals,
): EngineReadinessPhase {
	if (signals.runtimeError) return "error";
	if (signals.allLoadingComplete) return "ready";
	if (signals.interactionReady) return "interaction-ready";
	if (signals.sectionReady) return "loading";
	return "bootstrapping";
}

export function createReadinessDetail(args: {
	mode: "progressive" | "strict";
	signals: EngineReadinessSignals;
	reason?: string;
}): EngineReadinessDetail {
	// Final ready must always be gated by section lifecycle and complete loading.
	const finalReady =
		args.signals.sectionReady && args.signals.allLoadingComplete;
	const interactionReady =
		args.mode === "strict" ? finalReady : args.signals.interactionReady;
	const phase = resolveReadinessPhase({
		...args.signals,
		allLoadingComplete: finalReady,
		interactionReady,
	});

	return {
		phase,
		interactionReady,
		allLoadingComplete: finalReady,
		reason: args.reason,
	};
}
