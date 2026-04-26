export const SECTION_PLAYER_PUBLIC_EVENTS = {
	runtimeOwned: "runtime-owned",
	runtimeInherited: "runtime-inherited",
	/**
	 * Deprecated alias for `frameworkError`. Kept for hosts that still
	 * subscribe to the old event name; new consumers should listen to
	 * `framework-error` and treat the detail as a `FrameworkErrorModel`.
	 */
	runtimeError: "runtime-error",
	frameworkError: "framework-error",
	compositionChanged: "composition-changed",
	sessionChanged: "session-changed",
	/**
	 * Canonical readiness vocabulary (M6). One DOM event family carries
	 * every stage transition (`attached` → `composed` → `runtime-bound` →
	 * `engine-ready` → `ui-rendered` → `interactive` → `disposed`) with
	 * the discriminator in `event.detail.stage`. See
	 * `packages/section-player/src/contracts/stages.ts`.
	 */
	stageChange: "pie-stage-change",
	/**
	 * Companion to `stageChange`. Fires once per cohort when every item
	 * in the section has finished loading (`loadedCount === itemCount`).
	 * Replaces the legacy `ready` event; semantics are unchanged.
	 */
	loadingComplete: "pie-loading-complete",
	/**
	 * @deprecated since M6 — listen for `stageChange` and filter on
	 * `detail.stage === "engine-ready"` (or wait via
	 * `engine.waitUntilStage("engine-ready")`).
	 */
	sectionControllerReady: "section-controller-ready",
	/**
	 * @deprecated since M6 — listen for `stageChange`. The transitions
	 * previously surfaced by `readiness-change` map to the new stage
	 * events; `readiness.mode = "strict"` still gates the `interactive`
	 * transition.
	 */
	readinessChange: "readiness-change",
	/**
	 * @deprecated since M6 — listen for `stageChange` and filter on
	 * `detail.stage === "interactive"`.
	 */
	interactionReady: "interaction-ready",
	/**
	 * @deprecated since M6 — listen for `loadingComplete`. The legacy
	 * `ready` event semantics ("all items loaded") are unchanged but the
	 * canonical event name is `pie-loading-complete`.
	 */
	ready: "ready",
} as const;

export type SectionPlayerPublicEventName =
	(typeof SECTION_PLAYER_PUBLIC_EVENTS)[keyof typeof SECTION_PLAYER_PUBLIC_EVENTS];

export type SectionPlayerReadinessPhase =
	| "bootstrapping"
	| "interaction-ready"
	| "loading"
	| "ready"
	| "error";

export type SectionPlayerReadinessChangeDetail = {
	phase: SectionPlayerReadinessPhase;
	interactionReady: boolean;
	allLoadingComplete: boolean;
	reason?: string;
};

export type SectionPlayerControllerReadyDetail = {
	sectionId: string;
	attemptId?: string;
	controller: unknown;
};
