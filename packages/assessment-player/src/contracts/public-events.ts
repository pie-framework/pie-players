export const ASSESSMENT_PLAYER_PUBLIC_EVENTS = {
	controllerReady: "assessment-controller-ready",
	navigationRequested: "assessment-navigation-requested",
	submitRequested: "assessment-submit-requested",
	routeChanged: "assessment-route-changed",
	sessionApplied: "assessment-session-applied",
	sessionChanged: "assessment-session-changed",
	progressChanged: "assessment-progress-changed",
	submissionStateChanged: "assessment-submission-state-changed",
	error: "assessment-error",
} as const;

export type AssessmentPlayerPublicEventName =
	(typeof ASSESSMENT_PLAYER_PUBLIC_EVENTS)[keyof typeof ASSESSMENT_PLAYER_PUBLIC_EVENTS];

export type AssessmentPlayerReadinessPhase =
	| "bootstrapping"
	| "hydrating"
	| "ready"
	| "error";

export interface AssessmentNavigationRequestedDetail {
	fromIndex: number;
	toIndex: number;
	fromSectionId?: string;
	toSectionId?: string;
	reason: "navigate-to" | "navigate-next" | "navigate-previous";
}

export interface AssessmentRouteChangedDetail {
	currentSectionIndex: number;
	totalSections: number;
	currentSectionId?: string;
	previousSectionId?: string;
	canNext: boolean;
	canPrevious: boolean;
}

export interface AssessmentProgressChangedDetail {
	visitedSectionCount: number;
	totalSections: number;
}

export interface AssessmentSubmissionStateChangedDetail {
	submitted: boolean;
}

export interface AssessmentReadinessChangeDetail {
	phase: AssessmentPlayerReadinessPhase;
}
