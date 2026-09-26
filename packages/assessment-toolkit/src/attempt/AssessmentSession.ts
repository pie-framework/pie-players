import type {
	AssessmentSession,
	AssessmentSectionSessionState,
	AssessmentSessionNavigationState,
	AssessmentSessionRealization,
	SectionControllerSessionState,
} from "@pie-players/pie-players-shared/types";

/**
 * Re-exported so every existing import site keeps its specifier. These shapes are
 * canonical in `@pie-players/pie-players-shared/types`; this module owns the
 * helpers over them, not the shapes.
 */
export type {
	AssessmentSession,
	AssessmentSectionSessionState,
	AssessmentSessionNavigationState,
	AssessmentSessionRealization,
};

const ASSESSMENT_SESSION_VERSION = 1 as const;

function nowIso(): string {
	return new Date().toISOString();
}

export function createNewAssessmentSession(args: {
	assessmentAttemptSessionIdentifier: string;
	assessmentId: string;
	seed: string;
	sectionIdentifiers: string[];
}): AssessmentSession {
	const startedAt = nowIso();
	const initialSectionIdentifier = args.sectionIdentifiers[0];
	return {
		version: ASSESSMENT_SESSION_VERSION,
		assessmentAttemptSessionIdentifier: args.assessmentAttemptSessionIdentifier,
		assessmentId: args.assessmentId,
		startedAt,
		updatedAt: startedAt,
		navigationState: {
			currentSectionIndex: 0,
			visitedSectionIdentifiers: initialSectionIdentifier
				? [initialSectionIdentifier]
				: [],
			currentSectionIdentifier: initialSectionIdentifier,
		},
		realization: {
			seed: args.seed,
			sectionIdentifiers: args.sectionIdentifiers,
		},
		sectionSessions: {},
	};
}

export function upsertSectionSession(
	session: AssessmentSession,
	args: {
		sectionIdentifier: string;
		sectionSession: SectionControllerSessionState | null;
	},
): AssessmentSession {
	if (!args.sectionIdentifier) return session;
	const updatedAt = nowIso();
	return {
		...session,
		updatedAt,
		sectionSessions: {
			...session.sectionSessions,
			[args.sectionIdentifier]: {
				sectionIdentifier: args.sectionIdentifier,
				updatedAt,
				session: args.sectionSession,
			},
		},
	};
}

export function setCurrentSectionPosition(
	session: AssessmentSession,
	args: {
		currentSectionIndex: number;
		currentSectionIdentifier?: string;
	},
): AssessmentSession {
	const visited = new Set(
		session.navigationState.visitedSectionIdentifiers || [],
	);
	if (args.currentSectionIdentifier) {
		visited.add(args.currentSectionIdentifier);
	}
	return {
		...session,
		navigationState: {
			...session.navigationState,
			currentSectionIndex: args.currentSectionIndex,
			currentSectionIdentifier: args.currentSectionIdentifier,
			visitedSectionIdentifiers: Array.from(visited),
		},
	};
}
