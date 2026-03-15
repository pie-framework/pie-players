import type { SectionControllerSessionState } from "../services/section-controller-types.js";
import type { StorageLike } from "./TestSession.js";

export interface AssessmentSessionNavigationState {
	currentSectionIndex: number;
	visitedSectionIdentifiers: string[];
	currentSectionIdentifier?: string;
}

export interface AssessmentSessionRealization {
	seed: string;
	sectionIdentifiers: string[];
}

export interface AssessmentSectionSessionState {
	sectionIdentifier: string;
	updatedAt: string;
	session: SectionControllerSessionState | null;
}

export interface AssessmentSession {
	version: 1;
	assessmentAttemptSessionIdentifier: string;
	assessmentId: string;
	startedAt: string;
	updatedAt: string;
	completedAt?: string;
	navigationState: AssessmentSessionNavigationState;
	realization: AssessmentSessionRealization;
	sectionSessions: Record<string, AssessmentSectionSessionState>;
	contextVariables?: Record<string, unknown>;
}

const ASSESSMENT_SESSION_VERSION = 1 as const;
const STORAGE_PREFIX = "pie:assessment-session:v1:";

function nowIso(): string {
	return new Date().toISOString();
}

export function getAssessmentSessionStorageKey(
	assessmentAttemptSessionIdentifier: string,
): string {
	return `${STORAGE_PREFIX}${assessmentAttemptSessionIdentifier}`;
}

export function loadAssessmentSession(
	storage: StorageLike,
	assessmentAttemptSessionIdentifier: string,
): AssessmentSession | null {
	const raw = storage.getItem(
		getAssessmentSessionStorageKey(assessmentAttemptSessionIdentifier),
	);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as AssessmentSession;
		if (!parsed || parsed.version !== ASSESSMENT_SESSION_VERSION) return null;
		if (
			parsed.assessmentAttemptSessionIdentifier !== assessmentAttemptSessionIdentifier
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function saveAssessmentSession(
	storage: StorageLike,
	session: AssessmentSession,
): void {
	const updated: AssessmentSession = {
		...session,
		updatedAt: nowIso(),
	};
	storage.setItem(
		getAssessmentSessionStorageKey(session.assessmentAttemptSessionIdentifier),
		JSON.stringify(updated),
	);
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
	const visited = new Set(session.navigationState.visitedSectionIdentifiers || []);
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
