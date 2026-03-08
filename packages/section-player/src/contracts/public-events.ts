export const SECTION_PLAYER_PUBLIC_EVENTS = {
	runtimeOwned: "runtime-owned",
	runtimeInherited: "runtime-inherited",
	runtimeError: "runtime-error",
	compositionChanged: "composition-changed",
	sessionChanged: "session-changed",
	sectionControllerReady: "section-controller-ready",
	readinessChange: "readiness-change",
	interactionReady: "interaction-ready",
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
