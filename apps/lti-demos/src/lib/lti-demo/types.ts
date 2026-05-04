export interface VerifiedLtiLaunchContext {
	platformIssuer: string;
	deploymentId: string;
	contextId: string;
	contextTitle: string;
	resourceLinkId: string;
	resourceTitle: string;
	userId: string;
	userDisplayName: string;
	roles: string[];
	assessmentId: string;
	attemptId: string;
	launchedAt: string;
}

export interface SectionSessionSnapshot {
	currentItemIndex?: number;
	visitedItemIdentifiers?: string[];
	itemSessions: Record<string, unknown>;
}

export interface AssessmentSessionSnapshot {
	version: 1;
	assessmentAttemptSessionIdentifier: string;
	assessmentId: string;
	startedAt: string;
	updatedAt: string;
	completedAt?: string;
	navigationState: {
		currentSectionIndex: number;
		visitedSectionIdentifiers: string[];
		currentSectionIdentifier?: string;
	};
	realization: {
		seed: string;
		sectionIdentifiers: string[];
	};
	sectionSessions: Record<
		string,
		{
			sectionIdentifier: string;
			updatedAt: string;
			session: SectionSessionSnapshot | null;
		}
	>;
	contextVariables?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface SessionPersistenceKey {
	assessmentId: string;
	attemptId: string;
}
