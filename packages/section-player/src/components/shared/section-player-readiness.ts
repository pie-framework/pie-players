import type {
	SectionPlayerReadinessChangeDetail,
	SectionPlayerReadinessPhase,
} from "../../contracts/public-events.js";

export type ReadinessSignals = {
	sectionReady: boolean;
	interactionReady: boolean;
	allLoadingComplete: boolean;
	runtimeError: boolean;
};

export function resolveReadinessPhase(signals: ReadinessSignals): SectionPlayerReadinessPhase {
	if (signals.runtimeError) return "error";
	if (signals.allLoadingComplete) return "ready";
	if (signals.interactionReady) return "interaction-ready";
	if (signals.sectionReady) return "loading";
	return "bootstrapping";
}

export function createReadinessDetail(args: {
	mode: "progressive" | "strict";
	signals: ReadinessSignals;
	reason?: string;
}): SectionPlayerReadinessChangeDetail {
	// Final ready must always be gated by section lifecycle and complete loading.
	const finalReady = args.signals.sectionReady && args.signals.allLoadingComplete;
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
